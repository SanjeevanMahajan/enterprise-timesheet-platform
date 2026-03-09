"""Notification Service — persists in-app notifications from domain events and serves them via HTTP.

Dual-protocol service:
  - Redis Pub/Sub subscriber (write path) — creates notifications from domain events
  - FastAPI HTTP API (read path) — list, mark-read, and count endpoints

Listens to all domain events on the ``events`` channel and generates user-facing
notifications stored in a local SQLite database.
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
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CHANNEL = "events"
DB_PATH = os.getenv("NOTIFIER_DB", "/app/data/notifications.db")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("notifier")


# ---------------------------------------------------------------------------
# SQLite setup
# ---------------------------------------------------------------------------

def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id          TEXT PRIMARY KEY,
            tenant_id   TEXT NOT NULL,
            recipient_id TEXT NOT NULL,
            title       TEXT NOT NULL,
            body        TEXT NOT NULL DEFAULT '',
            category    TEXT NOT NULL DEFAULT 'general',
            is_read     INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_notif_recipient
        ON notifications(tenant_id, recipient_id, is_read, created_at DESC)
    """)
    conn.commit()
    conn.close()
    log.info("[NOTIFIER] SQLite database initialised at %s", DB_PATH)


def insert_notification(
    tenant_id: str,
    recipient_id: str,
    title: str,
    body: str = "",
    category: str = "general",
) -> None:
    conn = get_db()
    conn.execute(
        """INSERT INTO notifications (id, tenant_id, recipient_id, title, body, category, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?)""",
        (
            str(uuid.uuid4()),
            tenant_id,
            recipient_id,
            title,
            body,
            category,
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Event handlers — create notifications
# ---------------------------------------------------------------------------

def handle_user_registered(data: dict) -> None:
    email = data.get("email", "unknown")
    full_name = data.get("full_name", "")
    name = full_name or email
    tenant_id = data.get("tenant_id", "")
    user_id = data.get("user_id", "")
    if tenant_id and user_id:
        insert_notification(
            tenant_id, user_id,
            "Welcome to TimeTrack!",
            f"Your account ({email}) has been created. Start tracking time now.",
            "system",
        )
    log.info("[NOTIFIER] Welcome notification for %s", name)


def handle_time_log_created(data: dict) -> None:
    user_id = data.get("user_id", "")
    project_id = str(data.get("project_id", ""))[:8]
    hours = data.get("hours", 0)
    tenant_id = data.get("tenant_id", "")
    if tenant_id and user_id:
        insert_notification(
            tenant_id, user_id,
            "Time logged",
            f"{hours}h recorded on project {project_id}…",
            "timelog",
        )
    log.info("[NOTIFIER] Time log created: user=%s, hours=%s", user_id, hours)


def handle_timer_started(data: dict) -> None:
    log.info("[NOTIFIER] Timer started by User %s", data.get("user_id", "?"))


def handle_timer_stopped(data: dict) -> None:
    user_id = data.get("user_id", "")
    hours = data.get("hours", 0)
    tenant_id = data.get("tenant_id", "")
    if tenant_id and user_id:
        insert_notification(
            tenant_id, user_id,
            "Timer stopped",
            f"{hours:.1f}h captured from your timer session.",
            "timelog",
        )
    log.info("[NOTIFIER] Timer stopped: user=%s, hours=%s", user_id, hours)


def handle_project_created(data: dict) -> None:
    name = data.get("name", "unknown")
    tenant_id = data.get("tenant_id", "")
    owner_id = data.get("owner_id", "")
    if tenant_id and owner_id:
        insert_notification(
            tenant_id, owner_id,
            "Project created",
            f'"{name}" is ready for time tracking.',
            "project",
        )
    log.info("[NOTIFIER] Project created: %s", name)


def handle_timesheet_submitted(data: dict) -> None:
    user_id = data.get("user_id", "")
    total_hours = data.get("total_hours", 0)
    tenant_id = data.get("tenant_id", "")
    if tenant_id and user_id:
        insert_notification(
            tenant_id, user_id,
            "Timesheet submitted",
            f"{total_hours}h submitted for manager approval.",
            "timesheet",
        )
    log.info("[NOTIFIER] Timesheet submitted: user=%s, hours=%s", user_id, total_hours)


def handle_timesheet_approved(data: dict) -> None:
    user_id = data.get("user_id", "")
    tenant_id = data.get("tenant_id", "")
    if tenant_id and user_id:
        insert_notification(
            tenant_id, user_id,
            "Timesheet approved",
            "Your timesheet has been approved by your manager.",
            "timesheet",
        )
    log.info("[NOTIFIER] Timesheet approved: user=%s", user_id)


def handle_timesheet_rejected(data: dict) -> None:
    user_id = data.get("user_id", "")
    reason = data.get("reason", "")
    tenant_id = data.get("tenant_id", "")
    if tenant_id and user_id:
        insert_notification(
            tenant_id, user_id,
            "Timesheet rejected",
            f"Your timesheet was rejected.{(' Reason: ' + reason) if reason else ''}",
            "timesheet",
        )
    log.info("[NOTIFIER] Timesheet rejected: user=%s, reason=%s", user_id, reason)


def handle_timer_paused(data: dict) -> None:
    log.info("[NOTIFIER] Timer paused: user=%s", data.get("user_id", "?"))


def handle_timer_resumed(data: dict) -> None:
    log.info("[NOTIFIER] Timer resumed: user=%s", data.get("user_id", "?"))


def handle_time_log_approved(data: dict) -> None:
    user_id = data.get("user_id", "")
    hours = data.get("hours", 0)
    tenant_id = data.get("tenant_id", "")
    if tenant_id and user_id:
        insert_notification(
            tenant_id, user_id,
            "Time log approved",
            f"Your {hours}h entry has been approved.",
            "timelog",
        )
    log.info("[NOTIFIER] TimeLog approved: user=%s, hours=%s", user_id, hours)


def handle_time_log_rejected(data: dict) -> None:
    user_id = data.get("user_id", "")
    reason = data.get("reason", "")
    tenant_id = data.get("tenant_id", "")
    if tenant_id and user_id:
        insert_notification(
            tenant_id, user_id,
            "Time log rejected",
            f"Your time entry was rejected.{(' Reason: ' + reason) if reason else ''}",
            "timelog",
        )
    log.info("[NOTIFIER] TimeLog rejected: user=%s", user_id)


def handle_ai_insight(data: dict) -> None:
    log.info("[NOTIFIER] AI insight for log %s", data.get("time_log_id", "?"))


def handle_invoice_generated(data: dict) -> None:
    invoice_id = str(data.get("invoice_id", ""))[:8]
    total = data.get("total", 0)
    tenant_id = data.get("tenant_id", "")
    # Notify the tenant (we don't know exact user, use tenant_id as recipient)
    if tenant_id:
        insert_notification(
            tenant_id, tenant_id,
            "Invoice generated",
            f"Invoice {invoice_id}… for ${total:.2f} is ready.",
            "billing",
        )
    log.info("[NOTIFIER] Invoice generated: %s, total=$%.2f", invoice_id, total)


def handle_invoice_paid(data: dict) -> None:
    invoice_id = str(data.get("invoice_id", ""))[:8]
    total = data.get("total", 0)
    tenant_id = data.get("tenant_id", "")
    if tenant_id:
        insert_notification(
            tenant_id, tenant_id,
            "Payment received",
            f"Invoice {invoice_id}… — ${total:.2f} paid successfully.",
            "billing",
        )
    log.info("[NOTIFIER] Invoice paid: %s, total=$%.2f", invoice_id, total)


HANDLERS: dict[str, callable] = {
    "UserRegistered": handle_user_registered,
    "TimeLogCreated": handle_time_log_created,
    "TimerStarted": handle_timer_started,
    "TimerStopped": handle_timer_stopped,
    "TimerPaused": handle_timer_paused,
    "TimerResumed": handle_timer_resumed,
    "TimeLogApproved": handle_time_log_approved,
    "TimeLogRejected": handle_time_log_rejected,
    "ProjectCreated": handle_project_created,
    "TimesheetSubmitted": handle_timesheet_submitted,
    "TimesheetApproved": handle_timesheet_approved,
    "TimesheetRejected": handle_timesheet_rejected,
    "AIInsightGenerated": handle_ai_insight,
    "InvoiceGenerated": handle_invoice_generated,
    "InvoicePaid": handle_invoice_paid,
}


# ---------------------------------------------------------------------------
# Redis subscriber (background thread)
# ---------------------------------------------------------------------------

def redis_subscriber_loop() -> None:
    log.info("[NOTIFIER] Redis subscriber thread starting...")

    while True:
        try:
            client = redis.from_url(REDIS_URL, decode_responses=True)
            client.ping()
            log.info("[NOTIFIER] Connected to Redis. Subscribing to '%s'...", CHANNEL)

            pubsub = client.pubsub()
            pubsub.subscribe(CHANNEL)

            for message in pubsub.listen():
                if message["type"] != "message":
                    continue

                try:
                    data = json.loads(message["data"])
                except json.JSONDecodeError:
                    log.warning("[NOTIFIER] Invalid JSON: %s", message["data"])
                    continue

                event_type = data.get("event_type", "Unknown")
                handler = HANDLERS.get(event_type)

                if handler:
                    handler(data)
                else:
                    log.info("[NOTIFIER] Unhandled event: %s", event_type)

        except redis.ConnectionError:
            log.warning("[NOTIFIER] Redis connection lost. Reconnecting in 3s...")
            time.sleep(3)
        except Exception:
            log.exception("[NOTIFIER] Unexpected error in subscriber. Retrying in 3s...")
            time.sleep(3)


# ---------------------------------------------------------------------------
# FastAPI HTTP API (read path)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    thread = threading.Thread(target=redis_subscriber_loop, daemon=True)
    thread.start()
    log.info("[NOTIFIER] HTTP API ready on port 8004")
    yield


app = FastAPI(title="Notification Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/notifications")
def list_notifications(
    tenant_id: str = Query(..., min_length=1),
    recipient_id: str = Query("", description="Filter by recipient (optional)"),
    unread_only: bool = Query(False),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Return notifications for a tenant, optionally filtered by recipient."""
    conn = get_db()

    conditions = ["tenant_id = ?"]
    params: list = [tenant_id]

    if recipient_id:
        # Also include tenant-level notifications (recipient_id == tenant_id)
        conditions.append("(recipient_id = ? OR recipient_id = ?)")
        params.extend([recipient_id, tenant_id])

    if unread_only:
        conditions.append("is_read = 0")

    where = " AND ".join(conditions)
    rows = conn.execute(
        f"SELECT * FROM notifications WHERE {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        params + [limit, offset],
    ).fetchall()

    total = conn.execute(
        f"SELECT COUNT(*) FROM notifications WHERE {where}",
        params,
    ).fetchone()[0]

    conn.close()

    return {
        "notifications": [dict(r) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@app.get("/api/notifications/unread-count")
def unread_count(
    tenant_id: str = Query(..., min_length=1),
    recipient_id: str = Query("", description="Filter by recipient"),
):
    """Return the count of unread notifications."""
    conn = get_db()

    conditions = ["tenant_id = ?", "is_read = 0"]
    params: list = [tenant_id]

    if recipient_id:
        conditions.append("(recipient_id = ? OR recipient_id = ?)")
        params.extend([recipient_id, tenant_id])

    where = " AND ".join(conditions)
    count = conn.execute(
        f"SELECT COUNT(*) FROM notifications WHERE {where}", params
    ).fetchone()[0]
    conn.close()

    return {"unread_count": count}


@app.post("/api/notifications/{notification_id}/read")
def mark_read(notification_id: str):
    """Mark a single notification as read."""
    conn = get_db()
    conn.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (notification_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.post("/api/notifications/mark-all-read")
def mark_all_read(
    tenant_id: str = Query(..., min_length=1),
    recipient_id: str = Query(""),
):
    """Mark all notifications as read for a tenant/recipient."""
    conn = get_db()
    if recipient_id:
        conn.execute(
            "UPDATE notifications SET is_read = 1 WHERE tenant_id = ? AND (recipient_id = ? OR recipient_id = ?)",
            (tenant_id, recipient_id, tenant_id),
        )
    else:
        conn.execute(
            "UPDATE notifications SET is_read = 1 WHERE tenant_id = ?",
            (tenant_id,),
        )
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/health")
def health():
    try:
        conn = get_db()
        conn.execute("SELECT 1")
        conn.close()
        return {"status": "ok"}
    except Exception:
        return {"status": "degraded", "db": "unreachable"}


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8004)
