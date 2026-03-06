"""Billing & Invoicing Service — turns time logs into billable line items and invoices.

Dual-protocol service:
  - Redis Pub/Sub subscriber (write path) — processes events in a background thread
  - FastAPI HTTP API (read path) — serves invoices, stats, and flagged items to the frontend

Pricing engine:  Total = Hours * Hourly Rate
AI guardrail:    quality_score < 40  ->  Pending Review (not auto-billed)
Invoice trigger: When 3+ line items are "ready_to_bill" for a tenant, bundle into invoice.
"""

from __future__ import annotations

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
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CHANNEL = "events"
DB_PATH = os.getenv("BILLING_DB_PATH", "/app/data/billing.db")

QUALITY_THRESHOLD = 40
INVOICE_BATCH_SIZE = 3

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("billing-service")


# ---------------------------------------------------------------------------
# Database setup (SQLite — this service owns its own data store)
# ---------------------------------------------------------------------------

def init_db(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS line_items (
            id              TEXT PRIMARY KEY,
            time_log_id     TEXT UNIQUE NOT NULL,
            tenant_id       TEXT NOT NULL,
            user_id         TEXT NOT NULL,
            project_id      TEXT NOT NULL,
            hours           REAL NOT NULL DEFAULT 0,
            hourly_rate     REAL,
            total           REAL NOT NULL DEFAULT 0,
            description     TEXT DEFAULT '',
            log_date        TEXT,
            category        TEXT,
            quality_score   INTEGER,
            billable        INTEGER NOT NULL DEFAULT 1,
            status          TEXT NOT NULL DEFAULT 'pending_ai',
            invoice_id      TEXT,
            created_at      TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS invoices (
            id              TEXT PRIMARY KEY,
            tenant_id       TEXT NOT NULL,
            total           REAL NOT NULL,
            line_item_count INTEGER NOT NULL,
            status          TEXT NOT NULL DEFAULT 'draft',
            created_at      TEXT NOT NULL
        );
    """)
    conn.commit()
    log.info("[BILLING] Database initialised at %s", path)
    return conn


# Shared database connection (thread-safe via WAL mode + check_same_thread=False)
db: sqlite3.Connection | None = None


def get_db() -> sqlite3.Connection:
    assert db is not None
    return db


# ---------------------------------------------------------------------------
# Pricing Engine
# ---------------------------------------------------------------------------

def calculate_total(hours: float, hourly_rate: float | None) -> float:
    """Total = Hours * Hourly Rate.  Returns 0 if rate is unknown."""
    if hourly_rate is None or hourly_rate <= 0:
        return 0.0
    return round(hours * hourly_rate, 2)


# ---------------------------------------------------------------------------
# Line-item operations
# ---------------------------------------------------------------------------

def upsert_line_item(conn: sqlite3.Connection, data: dict, source: str) -> dict | None:
    """Create or update a line item from a TimeLogCreated or TimerStopped event."""
    time_log_id = data.get("time_log_id")
    if not time_log_id:
        return None

    tenant_id = data.get("tenant_id", "unknown")
    user_id = data.get("user_id", "unknown")
    project_id = data.get("project_id", "unknown")
    hours = float(data.get("hours", 0))
    hourly_rate = data.get("hourly_rate")
    if hourly_rate is not None:
        hourly_rate = float(hourly_rate)
    billable = 1 if data.get("billable", True) else 0
    description = data.get("description", "")
    log_date = data.get("log_date", "")
    total = calculate_total(hours, hourly_rate)
    now = datetime.now(timezone.utc).isoformat()

    existing = conn.execute(
        "SELECT id, status FROM line_items WHERE time_log_id = ?", (time_log_id,)
    ).fetchone()

    if existing:
        conn.execute(
            """UPDATE line_items
               SET hours = ?, hourly_rate = ?, total = ?, description = ?,
                   billable = ?, log_date = ?
               WHERE time_log_id = ?""",
            (hours, hourly_rate, total, description, billable, log_date, time_log_id),
        )
        conn.commit()
        line_item_id = existing["id"]
        log.info(
            "[BILLING] Updated LineItem %s from %s — hours=%.2f, rate=%s, total=$%.2f",
            line_item_id, source, hours, hourly_rate, total,
        )
    else:
        line_item_id = str(uuid.uuid4())
        conn.execute(
            """INSERT INTO line_items
               (id, time_log_id, tenant_id, user_id, project_id, hours,
                hourly_rate, total, description, log_date, billable, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_ai', ?)""",
            (
                line_item_id, time_log_id, tenant_id, user_id, project_id,
                hours, hourly_rate, total, description, log_date, billable, now,
            ),
        )
        conn.commit()
        log.info(
            "[BILLING] Created LineItem %s from %s — hours=%.2f, rate=%s, total=$%.2f, status=pending_ai",
            line_item_id, source, hours, hourly_rate, total,
        )

    return {"line_item_id": line_item_id, "tenant_id": tenant_id}


def apply_ai_guardrail(
    conn: sqlite3.Connection, client: redis.Redis, data: dict,
) -> None:
    """Apply AI quality guardrail: score < 40 → pending_review, else → ready_to_bill."""
    time_log_id = data.get("time_log_id")
    if not time_log_id:
        return

    quality_score = data.get("quality_score")
    category = data.get("category")

    row = conn.execute(
        "SELECT id, tenant_id, billable, status FROM line_items WHERE time_log_id = ?",
        (time_log_id,),
    ).fetchone()

    if not row:
        log.warning("[BILLING] AI insight for unknown time_log %s — ignoring", time_log_id)
        return

    conn.execute(
        "UPDATE line_items SET category = ?, quality_score = ? WHERE id = ?",
        (category, quality_score, row["id"]),
    )

    if not row["billable"]:
        new_status = "non_billable"
    elif quality_score is not None and quality_score < QUALITY_THRESHOLD:
        new_status = "pending_review"
    else:
        new_status = "ready_to_bill"

    conn.execute("UPDATE line_items SET status = ? WHERE id = ?", (new_status, row["id"]))
    conn.commit()

    if new_status == "pending_review":
        log.info(
            "[BILLING] LineItem %s flagged as PENDING REVIEW — "
            "quality_score=%s < %s threshold",
            row["id"], quality_score, QUALITY_THRESHOLD,
        )
    elif new_status == "non_billable":
        log.info("[BILLING] LineItem %s marked non-billable — skipping", row["id"])
    else:
        log.info(
            "[BILLING] LineItem %s is READY TO BILL — quality_score=%s, category=%s",
            row["id"], quality_score, category,
        )
        try_generate_invoice(conn, client, row["tenant_id"])


# ---------------------------------------------------------------------------
# Invoice generation
# ---------------------------------------------------------------------------

def try_generate_invoice(
    conn: sqlite3.Connection, client: redis.Redis, tenant_id: str,
) -> None:
    """If there are enough ready line items for this tenant, generate an invoice."""
    rows = conn.execute(
        """SELECT id, total, description, hours, hourly_rate, category
           FROM line_items
           WHERE tenant_id = ? AND status = 'ready_to_bill'
           ORDER BY created_at""",
        (tenant_id,),
    ).fetchall()

    if len(rows) < INVOICE_BATCH_SIZE:
        log.info(
            "[BILLING] %d/%d ready items for tenant %s — waiting for more...",
            len(rows), INVOICE_BATCH_SIZE, tenant_id[:8],
        )
        return

    invoice_id = str(uuid.uuid4())
    invoice_total = round(sum(r["total"] for r in rows), 2)
    now = datetime.now(timezone.utc).isoformat()
    line_item_ids = [r["id"] for r in rows]

    conn.execute(
        """INSERT INTO invoices (id, tenant_id, total, line_item_count, status, created_at)
           VALUES (?, ?, ?, ?, 'draft', ?)""",
        (invoice_id, tenant_id, invoice_total, len(rows), now),
    )

    placeholders = ",".join("?" * len(line_item_ids))
    conn.execute(
        f"UPDATE line_items SET status = 'invoiced', invoice_id = ? WHERE id IN ({placeholders})",
        [invoice_id, *line_item_ids],
    )
    conn.commit()

    log.info(
        "[BILLING] === INVOICE GENERATED ===\n"
        "  Invoice ID:   %s\n"
        "  Tenant:       %s\n"
        "  Line Items:   %d\n"
        "  Total:        $%.2f",
        invoice_id, tenant_id[:8], len(rows), invoice_total,
    )

    for r in rows:
        rate_str = f"${r['hourly_rate']:.0f}/hr" if r["hourly_rate"] else "n/a"
        log.info(
            "  - %s | %.1fh x %s = $%.2f [%s]",
            (r["description"] or "Untitled")[:50],
            r["hours"],
            rate_str,
            r["total"],
            r["category"] or "General",
        )

    event = {
        "event_type": "InvoiceGenerated",
        "event_id": str(uuid.uuid4()),
        "occurred_at": now,
        "invoice_id": invoice_id,
        "tenant_id": tenant_id,
        "total": invoice_total,
        "line_item_count": len(rows),
        "line_item_ids": line_item_ids,
    }
    client.publish(CHANNEL, json.dumps(event))
    log.info("[BILLING] Published InvoiceGenerated event for invoice %s", invoice_id)


# ---------------------------------------------------------------------------
# Redis subscriber (runs in a background thread)
# ---------------------------------------------------------------------------

WATCHED_EVENTS = {"TimeLogCreated", "TimerStopped", "AIInsightGenerated"}


def handle_event(
    conn: sqlite3.Connection, client: redis.Redis, data: dict,
) -> None:
    event_type = data.get("event_type")

    if event_type in ("TimeLogCreated", "TimerStopped"):
        upsert_line_item(conn, data, source=event_type)

    elif event_type == "AIInsightGenerated":
        apply_ai_guardrail(conn, client, data)


def redis_subscriber_loop(conn: sqlite3.Connection) -> None:
    """Background thread: subscribe to Redis events and process them."""
    log.info("[BILLING] Redis subscriber thread starting...")

    while True:
        try:
            client = redis.from_url(REDIS_URL, decode_responses=True)
            client.ping()
            log.info("[BILLING] Connected. Subscribing to channel '%s'...", CHANNEL)

            pubsub = client.pubsub()
            pubsub.subscribe(CHANNEL)

            for message in pubsub.listen():
                if message["type"] != "message":
                    continue

                try:
                    data = json.loads(message["data"])
                except json.JSONDecodeError:
                    log.warning("[BILLING] Invalid JSON: %s", message["data"])
                    continue

                event_type = data.get("event_type", "Unknown")

                if event_type in WATCHED_EVENTS:
                    handle_event(conn, client, data)
                elif event_type == "InvoiceGenerated":
                    pass
                else:
                    log.debug("[BILLING] Ignoring event: %s", event_type)

        except redis.ConnectionError:
            log.warning("[BILLING] Redis connection lost. Reconnecting in 3s...")
            time.sleep(3)
        except Exception:
            log.exception("[BILLING] Unexpected error in subscriber. Retrying in 3s...")
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
    # Start Redis subscriber in a daemon thread
    thread = threading.Thread(target=redis_subscriber_loop, args=(db,), daemon=True)
    thread.start()
    log.info("[BILLING] HTTP API ready on port 8001")
    yield
    db.close()


app = FastAPI(title="Billing Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/stats")
def get_stats(tenant_id: str | None = None):
    """Revenue KPIs for the billing dashboard."""
    conn = get_db()
    where = "WHERE tenant_id = ?" if tenant_id else ""
    params: tuple = (tenant_id,) if tenant_id else ()

    # Total invoiced amount
    row = conn.execute(
        f"SELECT COALESCE(SUM(total), 0) AS total_invoiced, COUNT(*) AS invoice_count FROM invoices {where}",
        params,
    ).fetchone()
    total_invoiced = row["total_invoiced"]
    invoice_count = row["invoice_count"]

    # Awaiting approval (pending_review items)
    row2 = conn.execute(
        f"SELECT COUNT(*) AS cnt, COALESCE(SUM(total), 0) AS amount FROM line_items WHERE status = 'pending_review' {'AND tenant_id = ?' if tenant_id else ''}",
        params,
    ).fetchone()
    awaiting_count = row2["cnt"]
    awaiting_amount = row2["amount"]

    # Ready to bill
    row3 = conn.execute(
        f"SELECT COUNT(*) AS cnt, COALESCE(SUM(total), 0) AS amount FROM line_items WHERE status = 'ready_to_bill' {'AND tenant_id = ?' if tenant_id else ''}",
        params,
    ).fetchone()
    ready_count = row3["cnt"]
    ready_amount = row3["amount"]

    return {
        "total_invoiced": round(total_invoiced, 2),
        "invoice_count": invoice_count,
        "awaiting_review_count": awaiting_count,
        "awaiting_review_amount": round(awaiting_amount, 2),
        "ready_to_bill_count": ready_count,
        "ready_to_bill_amount": round(ready_amount, 2),
    }


@app.get("/api/invoices")
def list_invoices(tenant_id: str | None = None):
    """List all invoices, newest first."""
    conn = get_db()
    if tenant_id:
        rows = conn.execute(
            "SELECT * FROM invoices WHERE tenant_id = ? ORDER BY created_at DESC",
            (tenant_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM invoices ORDER BY created_at DESC"
        ).fetchall()
    return [row_to_dict(r) for r in rows]


@app.get("/api/invoices/{invoice_id}/line-items")
def get_invoice_line_items(invoice_id: str):
    """Get line items for a specific invoice."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM line_items WHERE invoice_id = ? ORDER BY created_at",
        (invoice_id,),
    ).fetchall()
    return [row_to_dict(r) for r in rows]


@app.get("/api/line-items/flagged")
def list_flagged_items(tenant_id: str | None = None):
    """List line items flagged for review (quality_score < threshold)."""
    conn = get_db()
    if tenant_id:
        rows = conn.execute(
            "SELECT * FROM line_items WHERE status = 'pending_review' AND tenant_id = ? ORDER BY created_at DESC",
            (tenant_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM line_items WHERE status = 'pending_review' ORDER BY created_at DESC"
        ).fetchall()
    return [row_to_dict(r) for r in rows]


@app.post("/api/line-items/{item_id}/approve")
def approve_line_item(item_id: str):
    """Approve a flagged line item so it becomes ready_to_bill."""
    conn = get_db()
    row = conn.execute(
        "SELECT id, tenant_id, status FROM line_items WHERE id = ?", (item_id,)
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Line item not found")

    if row["status"] != "pending_review":
        raise HTTPException(
            status_code=400,
            detail=f"Item is '{row['status']}', not 'pending_review'",
        )

    conn.execute(
        "UPDATE line_items SET status = 'ready_to_bill' WHERE id = ?", (item_id,)
    )
    conn.commit()
    log.info("[BILLING] LineItem %s manually approved → ready_to_bill", item_id)

    # Check if we can now generate an invoice
    try:
        client = redis.from_url(REDIS_URL, decode_responses=True)
        try_generate_invoice(conn, client, row["tenant_id"])
    except Exception:
        log.warning("[BILLING] Could not check invoice generation after approval")

    updated = conn.execute(
        "SELECT * FROM line_items WHERE id = ?", (item_id,)
    ).fetchone()
    return row_to_dict(updated)


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
