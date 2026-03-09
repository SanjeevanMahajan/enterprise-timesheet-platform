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
from datetime import datetime, timezone

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


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)
