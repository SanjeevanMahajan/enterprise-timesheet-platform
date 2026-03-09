"""Reporting & Analytics Service — OLAP-style aggregation over time-tracking events.

Dual-protocol service:
  - Redis Pub/Sub subscriber (write path) — flattens events into denormalized analytics tables
  - FastAPI HTTP API (read path) — serves aggregation queries and CSV exports

Listens for:
  - TimeLogApproved   → creates/updates fact record with hours, cost, project, user
  - AIInsightGenerated → enriches fact record with category + quality_score
  - InvoicePaid        → marks fact records as invoiced/paid for revenue tracking

Database: SQLite OLAP store — single flattened fact table optimised for GROUP BY.
"""

from __future__ import annotations

import csv
import io
import json
import logging
import os
import sqlite3
import sys
import threading
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import redis
import uvicorn
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CHANNEL = "events"
DB_PATH = os.getenv("REPORTING_DB_PATH", "/app/data/reporting.db")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("reporting-service")


# ---------------------------------------------------------------------------
# OLAP Database — denormalized fact table
# ---------------------------------------------------------------------------

def init_db(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS time_facts (
            id              TEXT PRIMARY KEY,
            time_log_id     TEXT UNIQUE NOT NULL,
            tenant_id       TEXT NOT NULL,
            user_id         TEXT NOT NULL,
            project_id      TEXT NOT NULL,
            hours           REAL NOT NULL DEFAULT 0,
            hourly_rate     REAL,
            cost            REAL NOT NULL DEFAULT 0,
            description     TEXT DEFAULT '',
            log_date        TEXT NOT NULL,
            log_week        TEXT NOT NULL,
            billable        INTEGER NOT NULL DEFAULT 1,
            category        TEXT,
            quality_score   INTEGER,
            invoice_paid    INTEGER NOT NULL DEFAULT 0,
            paid_amount     REAL NOT NULL DEFAULT 0,
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_facts_tenant ON time_facts(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_facts_project ON time_facts(project_id);
        CREATE INDEX IF NOT EXISTS idx_facts_week ON time_facts(log_week);
        CREATE INDEX IF NOT EXISTS idx_facts_category ON time_facts(category);
        CREATE INDEX IF NOT EXISTS idx_facts_user ON time_facts(user_id);
        CREATE INDEX IF NOT EXISTS idx_facts_log_date ON time_facts(log_date);

        CREATE TABLE IF NOT EXISTS project_budgets (
            project_id      TEXT PRIMARY KEY,
            tenant_id       TEXT NOT NULL,
            budget_hours    REAL NOT NULL DEFAULT 0,
            budget_cost     REAL NOT NULL DEFAULT 0,
            estimated_hours REAL NOT NULL DEFAULT 0,
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_budgets_tenant ON project_budgets(tenant_id);
    """)
    conn.commit()
    log.info("[REPORTING] OLAP database initialised at %s", path)
    return conn


db: sqlite3.Connection | None = None


def get_db() -> sqlite3.Connection:
    assert db is not None
    return db


# ---------------------------------------------------------------------------
# Helper: ISO week string from date (e.g. "2026-W10")
# ---------------------------------------------------------------------------

def date_to_week(date_str: str) -> str:
    """Convert 'YYYY-MM-DD' to 'YYYY-Www' ISO week."""
    try:
        d = datetime.strptime(date_str[:10], "%Y-%m-%d")
        iso_year, iso_week, _ = d.isocalendar()
        return f"{iso_year}-W{iso_week:02d}"
    except (ValueError, TypeError):
        return "unknown"


# ---------------------------------------------------------------------------
# Event handlers (write path)
# ---------------------------------------------------------------------------

def handle_time_log_approved(conn: sqlite3.Connection, data: dict) -> None:
    """Upsert a fact row from a TimeLogApproved event."""
    time_log_id = data.get("time_log_id")
    if not time_log_id:
        return

    tenant_id = data.get("tenant_id", "unknown")
    user_id = data.get("user_id", "unknown")
    project_id = data.get("project_id", "unknown")
    hours = float(data.get("hours", 0))
    hourly_rate = data.get("hourly_rate")
    if hourly_rate is not None:
        hourly_rate = float(hourly_rate)
    billable = 1 if data.get("billable", True) else 0
    description = data.get("description", "")
    log_date = str(data.get("log_date", ""))
    log_week = date_to_week(log_date)
    cost = round(hours * (hourly_rate or 0), 2)
    now = datetime.now(timezone.utc).isoformat()

    existing = conn.execute(
        "SELECT id FROM time_facts WHERE time_log_id = ?", (time_log_id,)
    ).fetchone()

    if existing:
        conn.execute(
            """UPDATE time_facts
               SET hours = ?, hourly_rate = ?, cost = ?, description = ?,
                   billable = ?, log_date = ?, log_week = ?, project_id = ?,
                   user_id = ?, updated_at = ?
               WHERE time_log_id = ?""",
            (hours, hourly_rate, cost, description, billable,
             log_date, log_week, project_id, user_id, now, time_log_id),
        )
        log.info("[REPORTING] Updated fact for TimeLog %s", time_log_id[:8] if len(time_log_id) > 8 else time_log_id)
    else:
        fact_id = str(uuid.uuid4())
        conn.execute(
            """INSERT INTO time_facts
               (id, time_log_id, tenant_id, user_id, project_id, hours,
                hourly_rate, cost, description, log_date, log_week, billable,
                created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (fact_id, time_log_id, tenant_id, user_id, project_id,
             hours, hourly_rate, cost, description, log_date, log_week,
             billable, now, now),
        )
        log.info("[REPORTING] Created fact for TimeLog %s — %.1fh, $%.2f", time_log_id[:8] if len(time_log_id) > 8 else time_log_id, hours, cost)

    conn.commit()


def handle_ai_insight(conn: sqlite3.Connection, data: dict) -> None:
    """Enrich a fact row with AI category and quality score."""
    time_log_id = data.get("time_log_id")
    if not time_log_id:
        return

    category = data.get("category")
    quality_score = data.get("quality_score")
    now = datetime.now(timezone.utc).isoformat()

    result = conn.execute(
        "UPDATE time_facts SET category = ?, quality_score = ?, updated_at = ? WHERE time_log_id = ?",
        (category, quality_score, now, time_log_id),
    )
    conn.commit()

    if result.rowcount > 0:
        log.info("[REPORTING] Enriched fact %s — category=%s, score=%s", time_log_id[:8] if len(time_log_id) > 8 else time_log_id, category, quality_score)
    else:
        log.debug("[REPORTING] AI insight for unknown time_log %s — will catch on next approved event", time_log_id[:8] if len(time_log_id) > 8 else time_log_id)


def handle_invoice_paid(conn: sqlite3.Connection, data: dict) -> None:
    """Mark fact rows for an invoice as paid."""
    invoice_id = data.get("invoice_id")
    tenant_id = data.get("tenant_id")
    total = float(data.get("total", 0))
    now = datetime.now(timezone.utc).isoformat()

    if not tenant_id:
        return

    # We don't have per-line-item mapping from InvoicePaid, so mark all
    # unpaid rows for this tenant as paid (best-effort denormalisation).
    # A more precise approach would use line_item_ids from InvoiceGenerated.
    result = conn.execute(
        """UPDATE time_facts
           SET invoice_paid = 1, paid_amount = cost, updated_at = ?
           WHERE tenant_id = ? AND invoice_paid = 0 AND billable = 1""",
        (now, tenant_id),
    )
    conn.commit()
    log.info(
        "[REPORTING] Marked %d facts as paid for tenant %s (invoice %s, $%.2f)",
        result.rowcount, tenant_id[:8] if tenant_id and len(tenant_id) > 8 else tenant_id,
        invoice_id[:8] if invoice_id and len(invoice_id) > 8 else invoice_id, total,
    )


# ---------------------------------------------------------------------------
# Redis subscriber (background thread)
# ---------------------------------------------------------------------------

HANDLERS = {
    "TimeLogApproved": "time_log_approved",
    "AIInsightGenerated": "ai_insight",
    "InvoicePaid": "invoice_paid",
}


def redis_subscriber_loop(conn: sqlite3.Connection) -> None:
    log.info("[REPORTING] Redis subscriber thread starting...")

    while True:
        try:
            client = redis.from_url(REDIS_URL, decode_responses=True)
            client.ping()
            log.info("[REPORTING] Connected. Subscribing to channel '%s'...", CHANNEL)

            pubsub = client.pubsub()
            pubsub.subscribe(CHANNEL)

            for message in pubsub.listen():
                if message["type"] != "message":
                    continue

                try:
                    data = json.loads(message["data"])
                except json.JSONDecodeError:
                    log.warning("[REPORTING] Invalid JSON: %s", message["data"])
                    continue

                event_type = data.get("event_type", "Unknown")

                if event_type == "TimeLogApproved":
                    handle_time_log_approved(conn, data)
                elif event_type == "AIInsightGenerated":
                    handle_ai_insight(conn, data)
                elif event_type == "InvoicePaid":
                    handle_invoice_paid(conn, data)
                else:
                    log.debug("[REPORTING] Ignoring event: %s", event_type)

        except redis.ConnectionError:
            log.warning("[REPORTING] Redis connection lost. Reconnecting in 3s...")
            time.sleep(3)
        except Exception:
            log.exception("[REPORTING] Unexpected error in subscriber. Retrying in 3s...")
            time.sleep(3)


# ---------------------------------------------------------------------------
# FastAPI HTTP API (read path)
# ---------------------------------------------------------------------------

def row_to_dict(row: sqlite3.Row) -> dict:
    return dict(row)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global db
    db = init_db(DB_PATH)
    thread = threading.Thread(target=redis_subscriber_loop, args=(db,), daemon=True)
    thread.start()
    log.info("[REPORTING] HTTP API ready on port 8002")
    yield
    db.close()


app = FastAPI(title="Reporting & Analytics Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# GET /api/reports/burn-rate — weekly aggregated hours and costs
# ---------------------------------------------------------------------------

@app.get("/api/reports/burn-rate")
def burn_rate(
    tenant_id: str | None = None,
    project_id: str | None = None,
    client_id: str | None = None,
):
    """Weekly burn rate: hours and cost aggregated by ISO week.

    Filters:
      - tenant_id: scope to a single tenant
      - project_id: scope to a single project
      - client_id: reserved for future client-scoped filtering
    """
    conn = get_db()

    conditions = []
    params: list = []

    if tenant_id:
        conditions.append("tenant_id = ?")
        params.append(tenant_id)
    if project_id:
        conditions.append("project_id = ?")
        params.append(project_id)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    rows = conn.execute(
        f"""SELECT
                log_week,
                SUM(hours)       AS total_hours,
                SUM(cost)        AS total_cost,
                COUNT(*)         AS entry_count,
                SUM(CASE WHEN billable = 1 THEN hours ELSE 0 END) AS billable_hours,
                SUM(CASE WHEN billable = 0 THEN hours ELSE 0 END) AS non_billable_hours
            FROM time_facts
            {where}
            GROUP BY log_week
            ORDER BY log_week""",
        params,
    ).fetchall()

    return [
        {
            "week": r["log_week"],
            "total_hours": round(r["total_hours"], 2),
            "total_cost": round(r["total_cost"], 2),
            "entry_count": r["entry_count"],
            "billable_hours": round(r["billable_hours"], 2),
            "non_billable_hours": round(r["non_billable_hours"], 2),
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# GET /api/reports/productivity — AI category breakdown
# ---------------------------------------------------------------------------

@app.get("/api/reports/productivity")
def productivity(
    tenant_id: str | None = None,
    project_id: str | None = None,
):
    """Productivity breakdown by AI-assigned work category.

    Returns percentage of hours per category (e.g. 'Development' vs 'Maintenance').
    """
    conn = get_db()

    conditions = []
    params: list = []

    if tenant_id:
        conditions.append("tenant_id = ?")
        params.append(tenant_id)
    if project_id:
        conditions.append("project_id = ?")
        params.append(project_id)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    # Total hours for percentage calculation
    total_row = conn.execute(
        f"SELECT COALESCE(SUM(hours), 0) AS total FROM time_facts {where}",
        params,
    ).fetchone()
    total_hours = total_row["total"] or 1  # avoid div/0

    rows = conn.execute(
        f"""SELECT
                COALESCE(category, 'Uncategorised') AS category,
                SUM(hours)                          AS hours,
                COUNT(*)                            AS entry_count,
                AVG(quality_score)                  AS avg_quality_score
            FROM time_facts
            {where}
            GROUP BY COALESCE(category, 'Uncategorised')
            ORDER BY hours DESC""",
        params,
    ).fetchall()

    return [
        {
            "category": r["category"],
            "hours": round(r["hours"], 2),
            "percentage": round((r["hours"] / total_hours) * 100, 1),
            "entry_count": r["entry_count"],
            "avg_quality_score": round(r["avg_quality_score"], 1) if r["avg_quality_score"] else None,
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# GET /api/reports/export — CSV download of raw flattened data
# ---------------------------------------------------------------------------

@app.get("/api/reports/export")
def export_csv(
    tenant_id: str | None = None,
    project_id: str | None = None,
):
    """Export raw analytics data as CSV for Excel / BI tools."""
    conn = get_db()

    conditions = []
    params: list = []

    if tenant_id:
        conditions.append("tenant_id = ?")
        params.append(tenant_id)
    if project_id:
        conditions.append("project_id = ?")
        params.append(project_id)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    rows = conn.execute(
        f"""SELECT
                time_log_id, tenant_id, user_id, project_id,
                hours, hourly_rate, cost, description,
                log_date, log_week, billable, category,
                quality_score, invoice_paid, paid_amount
            FROM time_facts
            {where}
            ORDER BY log_date DESC""",
        params,
    ).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "time_log_id", "tenant_id", "user_id", "project_id",
        "hours", "hourly_rate", "cost", "description",
        "log_date", "log_week", "billable", "category",
        "quality_score", "invoice_paid", "paid_amount",
    ])
    for r in rows:
        writer.writerow([
            r["time_log_id"], r["tenant_id"], r["user_id"], r["project_id"],
            r["hours"], r["hourly_rate"], r["cost"], r["description"],
            r["log_date"], r["log_week"], r["billable"], r["category"],
            r["quality_score"], r["invoice_paid"], r["paid_amount"],
        ])

    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=timesheet-report.csv"},
    )


# ---------------------------------------------------------------------------
# GET /api/reports/summary — quick dashboard KPIs
# ---------------------------------------------------------------------------

@app.get("/api/reports/summary")
def summary(tenant_id: str | None = None):
    """Dashboard-level KPIs for the reporting page."""
    conn = get_db()

    conditions = []
    params: list = []

    if tenant_id:
        conditions.append("tenant_id = ?")
        params.append(tenant_id)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    row = conn.execute(
        f"""SELECT
                COUNT(*)                 AS total_entries,
                COALESCE(SUM(hours), 0)  AS total_hours,
                COALESCE(SUM(cost), 0)   AS total_cost,
                COALESCE(SUM(CASE WHEN invoice_paid = 1 THEN paid_amount ELSE 0 END), 0) AS total_paid,
                COALESCE(AVG(quality_score), 0) AS avg_quality
            FROM time_facts {where}""",
        params,
    ).fetchone()

    return {
        "total_entries": row["total_entries"],
        "total_hours": round(row["total_hours"], 2),
        "total_cost": round(row["total_cost"], 2),
        "total_paid": round(row["total_paid"], 2),
        "avg_quality_score": round(row["avg_quality"], 1),
    }


# ---------------------------------------------------------------------------
# GET /api/reports/individual — personal hours, billable ratio, daily breakdown
# ---------------------------------------------------------------------------

@app.get("/api/reports/individual")
def individual_report(user_id: str = Query(...)):
    """Individual user report: personal hours, billable ratio, daily breakdown.

    Filters:
      - user_id (required): the user to report on
    """
    conn = get_db()

    log.info("[REPORTING] Individual report requested for user %s", user_id[:8] if len(user_id) > 8 else user_id)

    # Overall stats for this user
    totals = conn.execute(
        """SELECT
                COALESCE(SUM(hours), 0)                                      AS total_hours,
                COALESCE(SUM(cost), 0)                                       AS total_cost,
                COALESCE(SUM(CASE WHEN billable = 1 THEN hours ELSE 0 END), 0) AS billable_hours,
                COALESCE(SUM(CASE WHEN billable = 0 THEN hours ELSE 0 END), 0) AS non_billable_hours,
                COUNT(*)                                                     AS entry_count,
                COALESCE(AVG(quality_score), 0)                              AS avg_quality
            FROM time_facts
            WHERE user_id = ?""",
        (user_id,),
    ).fetchone()

    total_hours = totals["total_hours"] or 0
    billable_hours = totals["billable_hours"] or 0
    billable_ratio = round((billable_hours / total_hours * 100), 1) if total_hours > 0 else 0.0

    # Daily breakdown
    daily_rows = conn.execute(
        """SELECT
                log_date,
                SUM(hours)  AS hours,
                SUM(cost)   AS cost,
                COUNT(*)    AS entries
            FROM time_facts
            WHERE user_id = ?
            GROUP BY log_date
            ORDER BY log_date""",
        (user_id,),
    ).fetchall()

    daily_breakdown = [
        {
            "date": r["log_date"],
            "hours": round(r["hours"], 2),
            "cost": round(r["cost"], 2),
            "entries": r["entries"],
        }
        for r in daily_rows
    ]

    # Project breakdown for this user
    project_rows = conn.execute(
        """SELECT
                project_id,
                SUM(hours) AS hours,
                SUM(cost)  AS cost
            FROM time_facts
            WHERE user_id = ?
            GROUP BY project_id
            ORDER BY hours DESC""",
        (user_id,),
    ).fetchall()

    projects = [
        {
            "project_id": r["project_id"],
            "hours": round(r["hours"], 2),
            "cost": round(r["cost"], 2),
        }
        for r in project_rows
    ]

    return {
        "user_id": user_id,
        "total_hours": round(total_hours, 2),
        "total_cost": round(totals["total_cost"], 2),
        "billable_hours": round(billable_hours, 2),
        "non_billable_hours": round(totals["non_billable_hours"], 2),
        "billable_ratio": billable_ratio,
        "entry_count": totals["entry_count"],
        "avg_quality_score": round(totals["avg_quality"], 1),
        "daily_breakdown": daily_breakdown,
        "projects": projects,
    }


# ---------------------------------------------------------------------------
# GET /api/reports/team — team-level: hours per user, capacity, top projects
# ---------------------------------------------------------------------------

@app.get("/api/reports/team")
def team_report(tenant_id: str = Query(...)):
    """Team-level report: hours per user, capacity utilization, top projects.

    Filters:
      - tenant_id (required): scope to a single tenant
    """
    conn = get_db()

    log.info("[REPORTING] Team report requested for tenant %s", tenant_id[:8] if len(tenant_id) > 8 else tenant_id)

    # Hours per user
    user_rows = conn.execute(
        """SELECT
                user_id,
                SUM(hours)                                                      AS total_hours,
                SUM(cost)                                                       AS total_cost,
                COALESCE(SUM(CASE WHEN billable = 1 THEN hours ELSE 0 END), 0)  AS billable_hours,
                COUNT(*)                                                        AS entry_count,
                COALESCE(AVG(quality_score), 0)                                 AS avg_quality
            FROM time_facts
            WHERE tenant_id = ?
            GROUP BY user_id
            ORDER BY total_hours DESC""",
        (tenant_id,),
    ).fetchall()

    # Capacity utilization — assume 40h/week standard capacity
    # Calculate weeks spanned by the data
    week_row = conn.execute(
        "SELECT COUNT(DISTINCT log_week) AS weeks FROM time_facts WHERE tenant_id = ?",
        (tenant_id,),
    ).fetchone()
    total_weeks = max(week_row["weeks"], 1)
    total_users = len(user_rows) or 1
    standard_capacity = total_users * total_weeks * 40  # 40h/week per user
    actual_hours = sum(r["total_hours"] for r in user_rows)
    capacity_utilization = round((actual_hours / standard_capacity * 100), 1) if standard_capacity > 0 else 0.0

    users = [
        {
            "user_id": r["user_id"],
            "total_hours": round(r["total_hours"], 2),
            "total_cost": round(r["total_cost"], 2),
            "billable_hours": round(r["billable_hours"], 2),
            "entry_count": r["entry_count"],
            "avg_quality_score": round(r["avg_quality"], 1),
        }
        for r in user_rows
    ]

    # Top projects by hours
    project_rows = conn.execute(
        """SELECT
                project_id,
                SUM(hours) AS total_hours,
                SUM(cost)  AS total_cost,
                COUNT(DISTINCT user_id) AS unique_users
            FROM time_facts
            WHERE tenant_id = ?
            GROUP BY project_id
            ORDER BY total_hours DESC
            LIMIT 10""",
        (tenant_id,),
    ).fetchall()

    top_projects = [
        {
            "project_id": r["project_id"],
            "total_hours": round(r["total_hours"], 2),
            "total_cost": round(r["total_cost"], 2),
            "unique_users": r["unique_users"],
        }
        for r in project_rows
    ]

    return {
        "tenant_id": tenant_id,
        "total_users": total_users,
        "total_hours": round(actual_hours, 2),
        "capacity_utilization_pct": capacity_utilization,
        "weeks_tracked": total_weeks,
        "users": users,
        "top_projects": top_projects,
    }


# ---------------------------------------------------------------------------
# GET /api/reports/executive — portfolio: margins, profitability, risk
# ---------------------------------------------------------------------------

@app.get("/api/reports/executive")
def executive_report(tenant_id: str = Query(...)):
    """Executive portfolio report: total margins, project profitability ranking,
    delivery risk assessment.

    Filters:
      - tenant_id (required): scope to a single tenant
    """
    conn = get_db()

    log.info("[REPORTING] Executive report requested for tenant %s", tenant_id[:8] if len(tenant_id) > 8 else tenant_id)

    # Portfolio totals
    totals = conn.execute(
        """SELECT
                COALESCE(SUM(hours), 0)  AS total_hours,
                COALESCE(SUM(cost), 0)   AS total_cost,
                COALESCE(SUM(CASE WHEN invoice_paid = 1 THEN paid_amount ELSE 0 END), 0) AS total_revenue,
                COALESCE(SUM(CASE WHEN billable = 1 THEN cost ELSE 0 END), 0)            AS billable_cost,
                COALESCE(SUM(CASE WHEN billable = 0 THEN cost ELSE 0 END), 0)            AS non_billable_cost,
                COUNT(DISTINCT project_id) AS project_count,
                COUNT(DISTINCT user_id)    AS user_count
            FROM time_facts
            WHERE tenant_id = ?""",
        (tenant_id,),
    ).fetchone()

    total_revenue = totals["total_revenue"]
    total_cost = totals["total_cost"]
    total_margin = round(total_revenue - total_cost, 2)
    margin_pct = round((total_margin / total_revenue * 100), 1) if total_revenue > 0 else 0.0

    # Project profitability ranking
    project_rows = conn.execute(
        """SELECT
                project_id,
                SUM(hours)                                                      AS hours,
                SUM(cost)                                                       AS cost,
                COALESCE(SUM(CASE WHEN invoice_paid = 1 THEN paid_amount ELSE 0 END), 0) AS revenue,
                COALESCE(SUM(CASE WHEN billable = 1 THEN hours ELSE 0 END), 0)  AS billable_hours,
                COALESCE(SUM(CASE WHEN billable = 0 THEN hours ELSE 0 END), 0)  AS non_billable_hours,
                COALESCE(AVG(quality_score), 0)                                 AS avg_quality,
                COUNT(DISTINCT user_id)                                         AS team_size
            FROM time_facts
            WHERE tenant_id = ?
            GROUP BY project_id
            ORDER BY revenue DESC""",
        (tenant_id,),
    ).fetchall()

    projects = []
    for r in project_rows:
        revenue = r["revenue"]
        cost = r["cost"]
        margin = round(revenue - cost, 2)
        margin_p = round((margin / revenue * 100), 1) if revenue > 0 else 0.0

        # Delivery risk heuristic: high non-billable ratio or low quality = higher risk
        hours = r["hours"] or 1
        non_billable_ratio = (r["non_billable_hours"] / hours) if hours > 0 else 0
        avg_q = r["avg_quality"] or 5
        risk_score = round(non_billable_ratio * 50 + max(0, (5 - avg_q)) * 10, 1)

        if risk_score >= 40:
            risk_level = "high"
        elif risk_score >= 20:
            risk_level = "medium"
        else:
            risk_level = "low"

        projects.append({
            "project_id": r["project_id"],
            "hours": round(r["hours"], 2),
            "cost": round(cost, 2),
            "revenue": round(revenue, 2),
            "margin": margin,
            "margin_pct": margin_p,
            "team_size": r["team_size"],
            "avg_quality_score": round(r["avg_quality"], 1),
            "risk_level": risk_level,
            "risk_score": risk_score,
        })

    return {
        "tenant_id": tenant_id,
        "total_hours": round(totals["total_hours"], 2),
        "total_cost": round(total_cost, 2),
        "total_revenue": round(total_revenue, 2),
        "total_margin": total_margin,
        "margin_pct": margin_pct,
        "project_count": totals["project_count"],
        "user_count": totals["user_count"],
        "billable_cost": round(totals["billable_cost"], 2),
        "non_billable_cost": round(totals["non_billable_cost"], 2),
        "projects": projects,
    }


# ---------------------------------------------------------------------------
# GET /api/reports/profitability — project profitability with budget tracking
# ---------------------------------------------------------------------------

@app.get("/api/reports/profitability")
def profitability_report(project_id: str = Query(...)):
    """Project profitability: hours vs budget, margin %, cost breakdown,
    scope creep indicator (estimated_hours vs actual_hours).

    Filters:
      - project_id (required): the project to report on

    Budget data comes from the project_budgets table.  If no budget row exists,
    budget fields are returned as null.
    """
    conn = get_db()

    log.info("[REPORTING] Profitability report requested for project %s", project_id[:8] if len(project_id) > 8 else project_id)

    # Actual hours / cost from time_facts
    actuals = conn.execute(
        """SELECT
                COALESCE(SUM(hours), 0)                                      AS actual_hours,
                COALESCE(SUM(cost), 0)                                       AS actual_cost,
                COALESCE(SUM(CASE WHEN billable = 1 THEN hours ELSE 0 END), 0) AS billable_hours,
                COALESCE(SUM(CASE WHEN billable = 0 THEN hours ELSE 0 END), 0) AS non_billable_hours,
                COALESCE(SUM(CASE WHEN billable = 1 THEN cost ELSE 0 END), 0)  AS billable_cost,
                COALESCE(SUM(CASE WHEN billable = 0 THEN cost ELSE 0 END), 0)  AS non_billable_cost,
                COALESCE(SUM(CASE WHEN invoice_paid = 1 THEN paid_amount ELSE 0 END), 0) AS revenue,
                COUNT(*)                                                     AS entry_count,
                COUNT(DISTINCT user_id)                                      AS team_size
            FROM time_facts
            WHERE project_id = ?""",
        (project_id,),
    ).fetchone()

    actual_hours = actuals["actual_hours"]
    actual_cost = actuals["actual_cost"]
    revenue = actuals["revenue"]
    margin = round(revenue - actual_cost, 2)
    margin_pct = round((margin / revenue * 100), 1) if revenue > 0 else 0.0

    # Budget data
    budget_row = conn.execute(
        "SELECT budget_hours, budget_cost, estimated_hours FROM project_budgets WHERE project_id = ?",
        (project_id,),
    ).fetchone()

    budget_hours = budget_row["budget_hours"] if budget_row else None
    budget_cost = budget_row["budget_cost"] if budget_row else None
    estimated_hours = budget_row["estimated_hours"] if budget_row else None

    hours_utilization = round((actual_hours / budget_hours * 100), 1) if budget_hours else None
    cost_utilization = round((actual_cost / budget_cost * 100), 1) if budget_cost else None

    # Scope creep: how much actual exceeds estimate
    scope_creep_pct = None
    scope_creep_status = "unknown"
    if estimated_hours and estimated_hours > 0:
        scope_creep_pct = round(((actual_hours - estimated_hours) / estimated_hours * 100), 1)
        if scope_creep_pct <= 0:
            scope_creep_status = "on_track"
        elif scope_creep_pct <= 15:
            scope_creep_status = "minor"
        elif scope_creep_pct <= 30:
            scope_creep_status = "moderate"
        else:
            scope_creep_status = "severe"

    # Weekly cost breakdown
    weekly_rows = conn.execute(
        """SELECT
                log_week,
                SUM(hours) AS hours,
                SUM(cost)  AS cost
            FROM time_facts
            WHERE project_id = ?
            GROUP BY log_week
            ORDER BY log_week""",
        (project_id,),
    ).fetchall()

    weekly_breakdown = [
        {
            "week": r["log_week"],
            "hours": round(r["hours"], 2),
            "cost": round(r["cost"], 2),
        }
        for r in weekly_rows
    ]

    return {
        "project_id": project_id,
        "actual_hours": round(actual_hours, 2),
        "actual_cost": round(actual_cost, 2),
        "revenue": round(revenue, 2),
        "margin": margin,
        "margin_pct": margin_pct,
        "budget_hours": budget_hours,
        "budget_cost": budget_cost,
        "estimated_hours": estimated_hours,
        "hours_utilization_pct": hours_utilization,
        "cost_utilization_pct": cost_utilization,
        "scope_creep_pct": scope_creep_pct,
        "scope_creep_status": scope_creep_status,
        "billable_hours": round(actuals["billable_hours"], 2),
        "non_billable_hours": round(actuals["non_billable_hours"], 2),
        "billable_cost": round(actuals["billable_cost"], 2),
        "non_billable_cost": round(actuals["non_billable_cost"], 2),
        "entry_count": actuals["entry_count"],
        "team_size": actuals["team_size"],
        "weekly_breakdown": weekly_breakdown,
    }


# ---------------------------------------------------------------------------
# PUT /api/reports/profitability/budget — set project budget (helper)
# ---------------------------------------------------------------------------

@app.put("/api/reports/profitability/budget")
def set_project_budget(
    project_id: str = Query(...),
    tenant_id: str = Query(...),
    budget_hours: float = Query(0),
    budget_cost: float = Query(0),
    estimated_hours: float = Query(0),
):
    """Set or update the budget for a project.  Used by the profitability report."""
    conn = get_db()
    now = datetime.now(timezone.utc).isoformat()

    existing = conn.execute(
        "SELECT project_id FROM project_budgets WHERE project_id = ?",
        (project_id,),
    ).fetchone()

    if existing:
        conn.execute(
            """UPDATE project_budgets
               SET budget_hours = ?, budget_cost = ?, estimated_hours = ?,
                   tenant_id = ?, updated_at = ?
               WHERE project_id = ?""",
            (budget_hours, budget_cost, estimated_hours, tenant_id, now, project_id),
        )
        log.info("[REPORTING] Updated budget for project %s", project_id[:8] if len(project_id) > 8 else project_id)
    else:
        conn.execute(
            """INSERT INTO project_budgets
               (project_id, tenant_id, budget_hours, budget_cost, estimated_hours,
                created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (project_id, tenant_id, budget_hours, budget_cost, estimated_hours, now, now),
        )
        log.info("[REPORTING] Created budget for project %s — %.0fh, $%.2f", project_id[:8] if len(project_id) > 8 else project_id, budget_hours, budget_cost)

    conn.commit()
    return {
        "project_id": project_id,
        "budget_hours": budget_hours,
        "budget_cost": budget_cost,
        "estimated_hours": estimated_hours,
    }


# ---------------------------------------------------------------------------
# GET /api/reports/forecast — predictive analytics via linear regression
# ---------------------------------------------------------------------------

def _linear_regression(xs: list[float], ys: list[float]) -> tuple[float, float]:
    """Simple linear regression returning (slope, intercept).

    Uses pure Python math — no numpy needed.
    Returns (0, 0) if regression cannot be computed.
    """
    n = len(xs)
    if n < 2:
        return 0.0, 0.0

    sum_x = sum(xs)
    sum_y = sum(ys)
    sum_xy = sum(x * y for x, y in zip(xs, ys))
    sum_x2 = sum(x * x for x in xs)

    denom = n * sum_x2 - sum_x * sum_x
    if abs(denom) < 1e-10:
        return 0.0, sum_y / n if n > 0 else 0.0

    slope = (n * sum_xy - sum_x * sum_y) / denom
    intercept = (sum_y - slope * sum_x) / n
    return slope, intercept


@app.get("/api/reports/forecast")
def forecast_report(project_id: str = Query(...)):
    """Predictive analytics: linear regression on weekly burn rate to forecast
    project completion date and budget exhaustion date.

    Filters:
      - project_id (required): the project to forecast
    """
    conn = get_db()

    log.info("[REPORTING] Forecast requested for project %s", project_id[:8] if len(project_id) > 8 else project_id)

    # Weekly burn data ordered chronologically
    weekly_rows = conn.execute(
        """SELECT
                log_week,
                SUM(hours) AS hours,
                SUM(cost)  AS cost
            FROM time_facts
            WHERE project_id = ?
            GROUP BY log_week
            ORDER BY log_week""",
        (project_id,),
    ).fetchall()

    if len(weekly_rows) < 2:
        return {
            "project_id": project_id,
            "error": "Insufficient data — need at least 2 weeks of entries for forecasting",
            "weeks_available": len(weekly_rows),
        }

    # Build cumulative series and weekly series
    xs = list(range(len(weekly_rows)))  # week indices 0, 1, 2, ...
    cumulative_hours = []
    cumulative_cost = []
    weekly_hours = []
    weekly_cost = []
    running_h = 0.0
    running_c = 0.0
    for r in weekly_rows:
        running_h += r["hours"]
        running_c += r["cost"]
        cumulative_hours.append(running_h)
        cumulative_cost.append(running_c)
        weekly_hours.append(r["hours"])
        weekly_cost.append(r["cost"])

    # Linear regression on weekly burn rate
    slope_h, intercept_h = _linear_regression(xs, weekly_hours)
    slope_c, intercept_c = _linear_regression(xs, weekly_cost)

    avg_weekly_hours = running_h / len(weekly_rows)
    avg_weekly_cost = running_c / len(weekly_rows)

    # Get budget from project_budgets if available
    budget_row = conn.execute(
        "SELECT budget_hours, budget_cost, estimated_hours FROM project_budgets WHERE project_id = ?",
        (project_id,),
    ).fetchone()

    budget_hours = budget_row["budget_hours"] if budget_row else None
    budget_cost = budget_row["budget_cost"] if budget_row else None
    estimated_hours = budget_row["estimated_hours"] if budget_row else None

    # Forecast: weeks until budget exhaustion (remaining / avg weekly)
    completion_forecast = None
    budget_exhaustion_forecast = None
    estimated_completion_date = None
    budget_exhaustion_date = None

    # Parse the last week string to get a reference date
    last_week_str = weekly_rows[-1]["log_week"]
    try:
        # Parse "YYYY-Www" format
        parts = last_week_str.split("-W")
        ref_year = int(parts[0])
        ref_week = int(parts[1])
        # Monday of the ISO week
        ref_date = datetime.strptime(f"{ref_year}-W{ref_week:02d}-1", "%Y-W%W-%w")
        if ref_date.year < ref_year:
            ref_date = datetime.fromisocalendar(ref_year, ref_week, 1)
    except (ValueError, IndexError):
        ref_date = datetime.now(timezone.utc)

    if budget_hours and budget_hours > running_h and avg_weekly_hours > 0:
        remaining_hours = budget_hours - running_h
        weeks_to_exhaust = remaining_hours / avg_weekly_hours
        budget_exhaustion_forecast = round(weeks_to_exhaust, 1)
        budget_exhaustion_date = (ref_date + timedelta(weeks=weeks_to_exhaust)).strftime("%Y-%m-%d")

    if estimated_hours and estimated_hours > running_h and avg_weekly_hours > 0:
        remaining = estimated_hours - running_h
        weeks_to_complete = remaining / avg_weekly_hours
        completion_forecast = round(weeks_to_complete, 1)
        estimated_completion_date = (ref_date + timedelta(weeks=weeks_to_complete)).strftime("%Y-%m-%d")

    # Build trend data
    trend = [
        {
            "week": weekly_rows[i]["log_week"],
            "hours": round(weekly_hours[i], 2),
            "cost": round(weekly_cost[i], 2),
            "cumulative_hours": round(cumulative_hours[i], 2),
            "cumulative_cost": round(cumulative_cost[i], 2),
        }
        for i in range(len(weekly_rows))
    ]

    return {
        "project_id": project_id,
        "weeks_tracked": len(weekly_rows),
        "total_hours": round(running_h, 2),
        "total_cost": round(running_c, 2),
        "avg_weekly_hours": round(avg_weekly_hours, 2),
        "avg_weekly_cost": round(avg_weekly_cost, 2),
        "burn_rate_trend_slope": round(slope_h, 4),
        "burn_rate_trend_direction": "increasing" if slope_h > 0.1 else ("decreasing" if slope_h < -0.1 else "stable"),
        "budget_hours": budget_hours,
        "budget_cost": budget_cost,
        "estimated_hours": estimated_hours,
        "weeks_to_budget_exhaustion": budget_exhaustion_forecast,
        "budget_exhaustion_date": budget_exhaustion_date,
        "weeks_to_estimated_completion": completion_forecast,
        "estimated_completion_date": estimated_completion_date,
        "trend": trend,
    }


# ---------------------------------------------------------------------------
# GET /api/reports/wellness — burnout detection and wellness indicators
# ---------------------------------------------------------------------------

@app.get("/api/reports/wellness")
def wellness_report(tenant_id: str = Query(...)):
    """Burnout detection: flag users with excessive hours, weekend work,
    or declining quality scores.

    Risk levels: healthy, watch, at_risk, critical

    Filters:
      - tenant_id (required): scope to a single tenant
    """
    conn = get_db()

    log.info("[REPORTING] Wellness report requested for tenant %s", tenant_id[:8] if len(tenant_id) > 8 else tenant_id)

    # Per-user weekly averages
    user_rows = conn.execute(
        """SELECT
                user_id,
                SUM(hours)                      AS total_hours,
                COUNT(DISTINCT log_week)         AS weeks_active,
                COALESCE(AVG(quality_score), 0)  AS avg_quality
            FROM time_facts
            WHERE tenant_id = ?
            GROUP BY user_id""",
        (tenant_id,),
    ).fetchall()

    users = []
    risk_counts = {"healthy": 0, "watch": 0, "at_risk": 0, "critical": 0}

    for r in user_rows:
        user_id = r["user_id"]
        total_hours = r["total_hours"]
        weeks_active = max(r["weeks_active"], 1)
        avg_weekly_hours = total_hours / weeks_active
        avg_quality = r["avg_quality"]

        # Weekend work detection (Saturday=6, Sunday=7 in ISO weekday)
        weekend_row = conn.execute(
            """SELECT COUNT(*) AS weekend_entries, COALESCE(SUM(hours), 0) AS weekend_hours
                FROM time_facts
                WHERE user_id = ? AND tenant_id = ?
                  AND CAST(strftime('%%w', log_date) AS INTEGER) IN (0, 6)""",
            (user_id, tenant_id),
        ).fetchone()
        weekend_entries = weekend_row["weekend_entries"]
        weekend_hours = weekend_row["weekend_hours"]

        # Quality trend: compare recent vs older quality scores
        recent_quality = conn.execute(
            """SELECT COALESCE(AVG(quality_score), 0) AS avg_q
                FROM time_facts
                WHERE user_id = ? AND tenant_id = ? AND quality_score IS NOT NULL
                ORDER BY log_date DESC LIMIT 10""",
            (user_id, tenant_id),
        ).fetchone()
        recent_q = recent_quality["avg_q"] if recent_quality else 0

        older_quality = conn.execute(
            """SELECT COALESCE(AVG(quality_score), 0) AS avg_q
                FROM (
                    SELECT quality_score FROM time_facts
                    WHERE user_id = ? AND tenant_id = ? AND quality_score IS NOT NULL
                    ORDER BY log_date ASC LIMIT 10
                )""",
            (user_id, tenant_id),
        ).fetchone()
        older_q = older_quality["avg_q"] if older_quality else 0
        quality_declining = recent_q < older_q - 0.5 if (recent_q > 0 and older_q > 0) else False

        # Risk assessment
        risk_score = 0
        risk_factors = []

        if avg_weekly_hours > 55:
            risk_score += 40
            risk_factors.append("severe_overtime")
        elif avg_weekly_hours > 50:
            risk_score += 30
            risk_factors.append("high_overtime")
        elif avg_weekly_hours > 45:
            risk_score += 15
            risk_factors.append("moderate_overtime")

        if weekend_hours > 8:
            risk_score += 20
            risk_factors.append("frequent_weekend_work")
        elif weekend_entries > 0:
            risk_score += 10
            risk_factors.append("occasional_weekend_work")

        if quality_declining:
            risk_score += 15
            risk_factors.append("declining_quality")

        if risk_score >= 50:
            risk_level = "critical"
        elif risk_score >= 30:
            risk_level = "at_risk"
        elif risk_score >= 15:
            risk_level = "watch"
        else:
            risk_level = "healthy"

        risk_counts[risk_level] += 1

        users.append({
            "user_id": user_id,
            "avg_weekly_hours": round(avg_weekly_hours, 1),
            "total_hours": round(total_hours, 2),
            "weeks_active": weeks_active,
            "weekend_entries": weekend_entries,
            "weekend_hours": round(weekend_hours, 2),
            "avg_quality_score": round(avg_quality, 1),
            "quality_declining": quality_declining,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "risk_factors": risk_factors,
        })

    # Sort by risk score descending so highest risk is first
    users.sort(key=lambda u: u["risk_score"], reverse=True)

    return {
        "tenant_id": tenant_id,
        "total_users": len(users),
        "risk_summary": risk_counts,
        "users": users,
    }


# ---------------------------------------------------------------------------
# GET /api/reports/export/pdf — HTML report file for print-to-PDF
# ---------------------------------------------------------------------------

@app.get("/api/reports/export/pdf")
def export_pdf(tenant_id: str = Query(...)):
    """Generate an HTML summary report downloadable as a file that can be
    printed to PDF in a browser.

    Filters:
      - tenant_id (required): scope to a single tenant
    """
    conn = get_db()

    log.info("[REPORTING] PDF export requested for tenant %s", tenant_id[:8] if len(tenant_id) > 8 else tenant_id)

    # Summary KPIs
    totals = conn.execute(
        """SELECT
                COUNT(*)                 AS total_entries,
                COALESCE(SUM(hours), 0)  AS total_hours,
                COALESCE(SUM(cost), 0)   AS total_cost,
                COALESCE(SUM(CASE WHEN invoice_paid = 1 THEN paid_amount ELSE 0 END), 0) AS total_paid,
                COALESCE(AVG(quality_score), 0)    AS avg_quality,
                COALESCE(SUM(CASE WHEN billable = 1 THEN hours ELSE 0 END), 0) AS billable_hours,
                COALESCE(SUM(CASE WHEN billable = 0 THEN hours ELSE 0 END), 0) AS non_billable_hours,
                COUNT(DISTINCT project_id) AS project_count,
                COUNT(DISTINCT user_id)    AS user_count
            FROM time_facts
            WHERE tenant_id = ?""",
        (tenant_id,),
    ).fetchone()

    billable_ratio = round(
        (totals["billable_hours"] / totals["total_hours"] * 100), 1
    ) if totals["total_hours"] > 0 else 0.0

    # Top projects
    project_rows = conn.execute(
        """SELECT project_id, SUM(hours) AS hours, SUM(cost) AS cost
            FROM time_facts WHERE tenant_id = ?
            GROUP BY project_id ORDER BY hours DESC LIMIT 10""",
        (tenant_id,),
    ).fetchall()

    project_rows_html = ""
    for r in project_rows:
        project_rows_html += (
            f"<tr><td>{r['project_id']}</td>"
            f"<td>{r['hours']:.1f}</td>"
            f"<td>${r['cost']:,.2f}</td></tr>\n"
        )

    # Top users
    user_rows = conn.execute(
        """SELECT user_id, SUM(hours) AS hours, SUM(cost) AS cost
            FROM time_facts WHERE tenant_id = ?
            GROUP BY user_id ORDER BY hours DESC LIMIT 10""",
        (tenant_id,),
    ).fetchall()

    user_rows_html = ""
    for r in user_rows:
        user_rows_html += (
            f"<tr><td>{r['user_id']}</td>"
            f"<td>{r['hours']:.1f}</td>"
            f"<td>${r['cost']:,.2f}</td></tr>\n"
        )

    report_date = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Timesheet Report — {tenant_id}</title>
    <style>
        body {{ font-family: Arial, Helvetica, sans-serif; margin: 40px; color: #333; }}
        h1 {{ color: #1a1a2e; border-bottom: 2px solid #1a1a2e; padding-bottom: 10px; }}
        h2 {{ color: #16213e; margin-top: 30px; }}
        .kpi-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0; }}
        .kpi {{ background: #f5f5f5; padding: 16px; border-radius: 8px; text-align: center; }}
        .kpi .value {{ font-size: 24px; font-weight: bold; color: #1a1a2e; }}
        .kpi .label {{ font-size: 12px; color: #666; margin-top: 4px; }}
        table {{ border-collapse: collapse; width: 100%; margin: 10px 0; }}
        th, td {{ border: 1px solid #ddd; padding: 8px 12px; text-align: left; }}
        th {{ background: #1a1a2e; color: white; }}
        tr:nth-child(even) {{ background: #f9f9f9; }}
        .footer {{ margin-top: 40px; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }}
        @media print {{ body {{ margin: 20px; }} }}
    </style>
</head>
<body>
    <h1>Timesheet Analytics Report</h1>
    <p><strong>Tenant:</strong> {tenant_id}<br>
       <strong>Generated:</strong> {report_date}</p>

    <h2>Key Performance Indicators</h2>
    <div class="kpi-grid">
        <div class="kpi">
            <div class="value">{totals['total_hours']:,.1f}</div>
            <div class="label">Total Hours</div>
        </div>
        <div class="kpi">
            <div class="value">${totals['total_cost']:,.2f}</div>
            <div class="label">Total Cost</div>
        </div>
        <div class="kpi">
            <div class="value">${totals['total_paid']:,.2f}</div>
            <div class="label">Revenue Collected</div>
        </div>
        <div class="kpi">
            <div class="value">{billable_ratio}%</div>
            <div class="label">Billable Ratio</div>
        </div>
        <div class="kpi">
            <div class="value">{totals['project_count']}</div>
            <div class="label">Projects</div>
        </div>
        <div class="kpi">
            <div class="value">{totals['user_count']}</div>
            <div class="label">Team Members</div>
        </div>
    </div>

    <h2>Top Projects by Hours</h2>
    <table>
        <tr><th>Project</th><th>Hours</th><th>Cost</th></tr>
        {project_rows_html}
    </table>

    <h2>Top Team Members by Hours</h2>
    <table>
        <tr><th>User</th><th>Hours</th><th>Cost</th></tr>
        {user_rows_html}
    </table>

    <div class="footer">
        Generated by Enterprise Timesheet Platform &mdash; Reporting Service
    </div>
</body>
</html>"""

    return StreamingResponse(
        io.StringIO(html),
        media_type="text/html",
        headers={"Content-Disposition": "attachment; filename=timesheet-report.html"},
    )


# ---------------------------------------------------------------------------
# GET /api/reports/digest — weekly narrative summary
# ---------------------------------------------------------------------------

@app.get("/api/reports/digest")
def weekly_digest(tenant_id: str = Query(...)):
    """Generate a weekly narrative digest: total hours, top project,
    busiest user, billable ratio, and trend vs previous week.

    Filters:
      - tenant_id (required): scope to a single tenant
    """
    conn = get_db()

    log.info("[REPORTING] Digest requested for tenant %s", tenant_id[:8] if len(tenant_id) > 8 else tenant_id)

    # Find the two most recent weeks with data
    week_rows = conn.execute(
        """SELECT DISTINCT log_week
            FROM time_facts
            WHERE tenant_id = ?
            ORDER BY log_week DESC
            LIMIT 2""",
        (tenant_id,),
    ).fetchall()

    if not week_rows:
        return {
            "tenant_id": tenant_id,
            "error": "No data available for digest generation",
        }

    current_week = week_rows[0]["log_week"]
    previous_week = week_rows[1]["log_week"] if len(week_rows) > 1 else None

    # Current week stats
    current = conn.execute(
        """SELECT
                COALESCE(SUM(hours), 0)  AS total_hours,
                COALESCE(SUM(cost), 0)   AS total_cost,
                COUNT(*)                 AS entry_count,
                COALESCE(SUM(CASE WHEN billable = 1 THEN hours ELSE 0 END), 0) AS billable_hours,
                COUNT(DISTINCT user_id)  AS active_users,
                COUNT(DISTINCT project_id) AS active_projects
            FROM time_facts
            WHERE tenant_id = ? AND log_week = ?""",
        (tenant_id, current_week),
    ).fetchone()

    current_hours = current["total_hours"]
    current_billable = current["billable_hours"]
    billable_ratio = round((current_billable / current_hours * 100), 1) if current_hours > 0 else 0.0

    # Top project this week
    top_project_row = conn.execute(
        """SELECT project_id, SUM(hours) AS hours
            FROM time_facts
            WHERE tenant_id = ? AND log_week = ?
            GROUP BY project_id
            ORDER BY hours DESC LIMIT 1""",
        (tenant_id, current_week),
    ).fetchone()
    top_project = top_project_row["project_id"] if top_project_row else "N/A"
    top_project_hours = round(top_project_row["hours"], 1) if top_project_row else 0

    # Busiest user this week
    top_user_row = conn.execute(
        """SELECT user_id, SUM(hours) AS hours
            FROM time_facts
            WHERE tenant_id = ? AND log_week = ?
            GROUP BY user_id
            ORDER BY hours DESC LIMIT 1""",
        (tenant_id, current_week),
    ).fetchone()
    top_user = top_user_row["user_id"] if top_user_row else "N/A"
    top_user_hours = round(top_user_row["hours"], 1) if top_user_row else 0

    # Previous week comparison
    trend = {}
    if previous_week:
        prev = conn.execute(
            """SELECT
                    COALESCE(SUM(hours), 0) AS total_hours,
                    COALESCE(SUM(cost), 0)  AS total_cost,
                    COALESCE(SUM(CASE WHEN billable = 1 THEN hours ELSE 0 END), 0) AS billable_hours
                FROM time_facts
                WHERE tenant_id = ? AND log_week = ?""",
            (tenant_id, previous_week),
        ).fetchone()

        prev_hours = prev["total_hours"]
        hours_delta = round(current_hours - prev_hours, 2)
        hours_change_pct = round((hours_delta / prev_hours * 100), 1) if prev_hours > 0 else 0.0

        prev_billable = prev["billable_hours"]
        prev_billable_ratio = round((prev_billable / prev_hours * 100), 1) if prev_hours > 0 else 0.0

        trend = {
            "previous_week": previous_week,
            "previous_hours": round(prev_hours, 2),
            "hours_delta": hours_delta,
            "hours_change_pct": hours_change_pct,
            "direction": "up" if hours_delta > 0 else ("down" if hours_delta < 0 else "flat"),
            "previous_billable_ratio": prev_billable_ratio,
        }

    # Build narrative
    narrative_parts = [
        f"Week {current_week}: the team logged {current_hours:.1f} hours "
        f"across {current['active_projects']} projects with "
        f"{current['active_users']} active members.",
    ]

    if trend:
        direction_word = "an increase" if trend["hours_delta"] > 0 else "a decrease"
        narrative_parts.append(
            f"This represents {direction_word} of {abs(trend['hours_delta']):.1f}h "
            f"({abs(trend['hours_change_pct']):.1f}%) compared to {previous_week}."
        )

    narrative_parts.append(
        f"Billable ratio stood at {billable_ratio}%."
    )
    narrative_parts.append(
        f"The top project was {top_project} ({top_project_hours}h), "
        f"and the busiest team member was {top_user} ({top_user_hours}h)."
    )

    narrative = " ".join(narrative_parts)

    return {
        "tenant_id": tenant_id,
        "week": current_week,
        "narrative": narrative,
        "total_hours": round(current_hours, 2),
        "total_cost": round(current["total_cost"], 2),
        "entry_count": current["entry_count"],
        "billable_ratio": billable_ratio,
        "active_users": current["active_users"],
        "active_projects": current["active_projects"],
        "top_project": {"project_id": top_project, "hours": top_project_hours},
        "top_user": {"user_id": top_user, "hours": top_user_hours},
        "trend": trend,
    }


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)
