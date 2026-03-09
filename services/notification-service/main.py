"""Notification Service — listens for domain events on Redis Pub/Sub.

Subscribes to the ``events`` channel and dispatches handlers based on event_type.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time

import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CHANNEL = "events"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("notifier")


# ---------------------------------------------------------------------------
# Event handlers
# ---------------------------------------------------------------------------

def handle_user_registered(data: dict) -> None:
    email = data.get("email", "unknown")
    full_name = data.get("full_name", "")
    name_part = f" ({full_name})" if full_name else ""
    log.info("[NOTIFIER] Sending Welcome Email to %s%s...", email, name_part)


def handle_time_log_created(data: dict) -> None:
    user_id = data.get("user_id", "unknown")
    project_id = data.get("project_id", "unknown")
    hours = data.get("hours", 0)
    log.info(
        "[NOTIFIER] Alerting manager about new TimeLog for User %s "
        "(project=%s, hours=%s)...",
        user_id,
        project_id,
        hours,
    )


def handle_timer_started(data: dict) -> None:
    user_id = data.get("user_id", "unknown")
    log.info("[NOTIFIER] Timer started by User %s...", user_id)


def handle_timer_stopped(data: dict) -> None:
    user_id = data.get("user_id", "unknown")
    hours = data.get("hours", 0)
    log.info("[NOTIFIER] Timer stopped by User %s (hours=%s)...", user_id, hours)


def handle_project_created(data: dict) -> None:
    name = data.get("name", "unknown")
    log.info("[NOTIFIER] New project created: %s", name)


def handle_timesheet_submitted(data: dict) -> None:
    user_id = data.get("user_id", "unknown")
    total_hours = data.get("total_hours", 0)
    log.info(
        "[NOTIFIER] Timesheet submitted by User %s (total_hours=%s) — pending approval...",
        user_id,
        total_hours,
    )


def handle_timesheet_approved(data: dict) -> None:
    user_id = data.get("user_id", "unknown")
    log.info("[NOTIFIER] Timesheet approved for User %s", user_id)


def handle_timesheet_rejected(data: dict) -> None:
    user_id = data.get("user_id", "unknown")
    reason = data.get("reason", "")
    log.info("[NOTIFIER] Timesheet rejected for User %s — reason: %s", user_id, reason)


def handle_timer_paused(data: dict) -> None:
    user_id = data.get("user_id", "unknown")
    accumulated = data.get("accumulated_seconds", 0)
    log.info("[NOTIFIER] Timer paused by User %s (accumulated=%ds)...", user_id, accumulated)


def handle_timer_resumed(data: dict) -> None:
    user_id = data.get("user_id", "unknown")
    log.info("[NOTIFIER] Timer resumed by User %s...", user_id)


def handle_time_log_approved(data: dict) -> None:
    time_log_id = data.get("time_log_id", "unknown")
    user_id = data.get("user_id", "unknown")
    hours = data.get("hours", 0)
    log.info(
        "[NOTIFIER] TimeLog %s APPROVED — user=%s, hours=%s. "
        "Forwarding to AI + Billing pipeline...",
        time_log_id,
        user_id,
        hours,
    )


def handle_time_log_rejected(data: dict) -> None:
    time_log_id = data.get("time_log_id", "unknown")
    user_id = data.get("user_id", "unknown")
    reason = data.get("reason", "")
    log.info(
        "[NOTIFIER] TimeLog %s REJECTED — user=%s, reason: %s",
        time_log_id,
        user_id,
        reason or "(no reason)",
    )


def handle_ai_insight(data: dict) -> None:
    time_log_id = data.get("time_log_id", "unknown")
    category = data.get("category", "unknown")
    score = data.get("quality_score", "?")
    suggestion = data.get("suggestion")
    log.info(
        "[NOTIFIER] AI Insight for Log %s — category=%s, quality=%s%s",
        time_log_id,
        category,
        score,
        f", suggestion: {suggestion}" if suggestion else "",
    )


def handle_invoice_generated(data: dict) -> None:
    invoice_id = data.get("invoice_id", "unknown")
    total = data.get("total", 0)
    count = data.get("line_item_count", 0)
    payment_url = data.get("payment_url")
    log.info(
        "[NOTIFIER] Invoice %s generated — %d line items, total $%.2f. "
        "Sending invoice email to client...%s",
        invoice_id,
        count,
        total,
        f"\n  Payment link: {payment_url}" if payment_url else "",
    )


def handle_invoice_paid(data: dict) -> None:
    invoice_id = data.get("invoice_id", "unknown")
    total = data.get("total", 0)
    tenant_id = data.get("tenant_id", "unknown")
    log.info(
        "[NOTIFIER] Invoice %s PAID ($%.2f) — "
        "Sending 'Thank You for your payment' receipt to client! (tenant=%s)",
        invoice_id,
        total,
        tenant_id[:8],
    )


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
# Consumer loop
# ---------------------------------------------------------------------------

def run() -> None:
    log.info("[NOTIFIER] Connecting to Redis at %s ...", REDIS_URL)

    while True:
        try:
            client = redis.from_url(REDIS_URL, decode_responses=True)
            client.ping()
            log.info("[NOTIFIER] Connected. Subscribing to channel '%s'...", CHANNEL)

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
                    log.info("[NOTIFIER] Received unhandled event: %s", event_type)

        except redis.ConnectionError:
            log.warning("[NOTIFIER] Redis connection lost. Reconnecting in 3s...")
            time.sleep(3)
        except KeyboardInterrupt:
            log.info("[NOTIFIER] Shutting down.")
            break


if __name__ == "__main__":
    run()
