"""AI Assistant Service — analyses time logs, detects anomalies, and provides insights.

Dual-protocol service:
  - Redis Pub/Sub subscriber (write path) — categorises time logs, indexes into SQLite
  - FastAPI HTTP API (read path) — anomaly detection, smart suggestions, NLP parsing,
    weekly digest

Subscribes to:
  - TimeLogCreated  -> categorise + quality analysis + index in SQLite
  - TimerStopped    -> categorise + quality analysis + index in SQLite

HTTP endpoints:
  - GET  /health
  - GET  /api/ai/anomalies?tenant_id=...
  - GET  /api/ai/suggestions?user_id=...
  - POST /api/ai/parse
  - GET  /api/ai/insights/weekly?tenant_id=...
"""

from __future__ import annotations

import json
import logging
import os
import re
import sqlite3
import sys
import threading
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

import redis
import uvicorn
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CHANNEL = "events"
SQLITE_DB = os.getenv("AI_SQLITE_DB", "/app/ai_service.db")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("ai-service")


# ---------------------------------------------------------------------------
# SQLite local database
# ---------------------------------------------------------------------------

_db_lock = threading.Lock()


def get_db() -> sqlite3.Connection:
    """Return a thread-local SQLite connection with WAL mode for concurrency."""
    conn = sqlite3.connect(SQLITE_DB, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    """Create the time_entries table if it does not exist."""
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS time_entries (
            id           TEXT PRIMARY KEY,
            tenant_id    TEXT NOT NULL,
            user_id      TEXT NOT NULL,
            project_id   TEXT NOT NULL,
            hours        REAL NOT NULL,
            description  TEXT NOT NULL DEFAULT '',
            log_date     TEXT NOT NULL,
            created_at   TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_time_entries_tenant
        ON time_entries (tenant_id)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_time_entries_user
        ON time_entries (user_id)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_time_entries_log_date
        ON time_entries (log_date)
    """)
    conn.commit()
    conn.close()
    log.info("[AI-SERVICE] SQLite database initialised at %s", SQLITE_DB)


def index_time_entry(data: dict) -> None:
    """Insert or replace a time entry from an event into local SQLite."""
    entry_id = data.get("time_log_id") or str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with _db_lock:
        conn = get_db()
        try:
            conn.execute(
                """INSERT OR REPLACE INTO time_entries
                   (id, tenant_id, user_id, project_id, hours, description, log_date, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    str(entry_id),
                    str(data.get("tenant_id", "")),
                    str(data.get("user_id", "")),
                    str(data.get("project_id", "")),
                    float(data.get("hours", 0)),
                    data.get("description", ""),
                    str(data.get("log_date", now[:10])),
                    data.get("occurred_at", now),
                ),
            )
            conn.commit()
        finally:
            conn.close()
    log.info("[AI-SERVICE] Indexed time entry %s into SQLite", str(entry_id)[:8])


# ---------------------------------------------------------------------------
# Mock LLM: Description quality analysis
# ---------------------------------------------------------------------------

MIN_WORD_COUNT = 5


def analyse_description(description: str) -> dict:
    """Mock LLM analysis of a time log description.

    Returns a dict with quality_score, suggestion (if low quality),
    and auto-detected category.
    """
    words = description.strip().split() if description else []
    word_count = len(words)

    # Quality score: 0-100 based on length and detail
    if word_count == 0:
        quality_score = 0
    elif word_count < MIN_WORD_COUNT:
        quality_score = max(10, word_count * 15)
    else:
        quality_score = min(100, 50 + word_count * 5)

    suggestion = None
    if word_count < MIN_WORD_COUNT:
        suggestion = (
            "Description is too brief. Consider adding what you worked on, "
            "why, and any outcomes or blockers."
        )

    return {
        "quality_score": quality_score,
        "word_count": word_count,
        "suggestion": suggestion,
    }


# ---------------------------------------------------------------------------
# Mock LLM: Work categorisation
# ---------------------------------------------------------------------------

CATEGORY_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\b(meet|standup|sync|retro|planning|scrum|daily|call)\w*\b", re.I), "Meetings"),
    (re.compile(r"\b(fix|bug|patch|hotfix|debug|issue)\w*\b", re.I), "Maintenance"),
    (re.compile(r"\b(test|spec|qa|coverage|assert)\w*\b", re.I), "Testing"),
    (re.compile(r"\bcode.review|pr.review|\bfeedback\w*\b", re.I), "Code Review"),
    (re.compile(r"\b(doc|readme|wiki|guide|onboard)\w*\b", re.I), "Documentation"),
    (re.compile(r"\b(deploy|release|ci|cd|pipeline|infra|devops)\w*\b", re.I), "DevOps"),
    (re.compile(r"\b(design|figma|mock|ui|ux|wireframe|prototype)\w*\b", re.I), "Design"),
    (re.compile(r"\b(refactor|cleanup|tech.debt|optimiz)\w*\b", re.I), "Refactoring"),
    (re.compile(r"\b(feat|feature|implement|build|add|create|develop)\w*\b", re.I), "Development"),
    (re.compile(r"\b(research|spike|investigat|explor|poc)\w*\b", re.I), "Research"),
]


def categorise_work(description: str) -> str:
    """Keyword-based work categorisation (mock LLM)."""
    for pattern, category in CATEGORY_RULES:
        if pattern.search(description):
            return category
    return "General"


# ---------------------------------------------------------------------------
# Event handling (existing logic, unchanged)
# ---------------------------------------------------------------------------

def publish_insight(client: redis.Redis, insight: dict) -> None:
    """Publish an AIInsightGenerated event back to Redis."""
    event = {
        "event_type": "AIInsightGenerated",
        "event_id": str(uuid.uuid4()),
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        **insight,
    }
    client.publish(CHANNEL, json.dumps(event))
    log.info("[AI-SERVICE] Published AIInsightGenerated for log %s", insight.get("time_log_id"))


def handle_time_log(client: redis.Redis, data: dict) -> None:
    """Analyse a TimeLogCreated or TimerStopped event."""
    time_log_id = data.get("time_log_id", "unknown")
    user_id = data.get("user_id", "unknown")
    description = data.get("description", "")
    hours = data.get("hours", 0)

    log.info(
        "[AI-SERVICE] Analysing TimeLog %s (user=%s, hours=%s)...",
        time_log_id, user_id, hours,
    )

    # 1. Description quality
    quality = analyse_description(description)

    if quality["suggestion"]:
        log.info(
            "[AI-SERVICE] WARNING: Low-quality description detected for Log %s. "
            "Suggesting more detail.",
            time_log_id,
        )
    else:
        log.info(
            "[AI-SERVICE] Description quality OK (score=%s, words=%s).",
            quality["quality_score"], quality["word_count"],
        )

    # 2. Work categorisation
    category = categorise_work(description)
    log.info(
        "[AI-SERVICE] Categorised as '%s' — \"%s\"",
        category,
        description[:60] + ("..." if len(description) > 60 else ""),
    )

    # 3. Publish insight back
    publish_insight(client, {
        "time_log_id": time_log_id,
        "user_id": user_id,
        "category": category,
        "quality_score": quality["quality_score"],
        "suggestion": quality["suggestion"],
    })

    # 4. Index into local SQLite for anomaly/suggestion features
    index_time_entry(data)


# ---------------------------------------------------------------------------
# Redis subscriber (background daemon thread)
# ---------------------------------------------------------------------------

WATCHED_EVENTS = {"TimeLogCreated", "TimerStopped"}


def redis_subscriber_loop() -> None:
    """Run the Redis Pub/Sub listener in a background thread."""
    log.info("[AI-SERVICE] Redis subscriber thread starting...")

    while True:
        try:
            client = redis.from_url(REDIS_URL, decode_responses=True)
            client.ping()
            log.info("[AI-SERVICE] Connected to Redis. Subscribing to '%s'...", CHANNEL)

            pubsub = client.pubsub()
            pubsub.subscribe(CHANNEL)

            for message in pubsub.listen():
                if message["type"] != "message":
                    continue

                try:
                    data = json.loads(message["data"])
                except json.JSONDecodeError:
                    log.warning("[AI-SERVICE] Invalid JSON: %s", message["data"])
                    continue

                event_type = data.get("event_type", "Unknown")

                if event_type in WATCHED_EVENTS:
                    handle_time_log(client, data)
                elif event_type == "AIInsightGenerated":
                    pass  # Ignore our own events to avoid loops
                else:
                    log.debug("[AI-SERVICE] Ignoring event: %s", event_type)

        except redis.ConnectionError:
            log.warning("[AI-SERVICE] Redis connection lost. Reconnecting in 3s...")
            time.sleep(3)
        except Exception:
            log.exception("[AI-SERVICE] Unexpected error in subscriber. Retrying in 3s...")
            time.sleep(3)


# ---------------------------------------------------------------------------
# FastAPI HTTP API (read path)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialise SQLite and start the Redis subscriber daemon thread."""
    init_db()

    thread = threading.Thread(target=redis_subscriber_loop, daemon=True)
    thread.start()
    log.info("[AI-SERVICE] HTTP API ready on port 8005")
    yield


app = FastAPI(title="AI Assistant Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    """Service health check."""
    return {"status": "ok", "service": "ai-service"}


# ---------------------------------------------------------------------------
# 1. Anomaly Detection
# ---------------------------------------------------------------------------

@app.get("/api/ai/anomalies")
def detect_anomalies(tenant_id: str = Query(..., description="Tenant ID")):
    """Detect suspicious time entry patterns for a tenant.

    Flags:
    - Entries >12h in a single day
    - Weekend work
    - Suspiciously round hours (exactly 8.0)
    - Duplicate descriptions on the same day
    - Hours much higher than user's average
    """
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM time_entries WHERE tenant_id = ? ORDER BY log_date DESC",
            (tenant_id,),
        ).fetchall()
    finally:
        conn.close()

    if not rows:
        return {"tenant_id": tenant_id, "anomalies": [], "total": 0}

    # Pre-compute per-user averages
    user_totals: dict[str, list[float]] = {}
    for r in rows:
        user_totals.setdefault(r["user_id"], []).append(r["hours"])
    user_avg: dict[str, float] = {
        uid: sum(hrs) / len(hrs) for uid, hrs in user_totals.items()
    }

    # Track descriptions per user per day for duplicate detection
    desc_tracker: dict[str, list[dict]] = {}  # key = f"{user_id}:{log_date}"

    anomalies: list[dict] = []

    for r in rows:
        entry = dict(r)
        entry_id = r["id"]
        hours = r["hours"]
        log_date = r["log_date"]
        user_id = r["user_id"]
        desc = r["description"]

        # Duplicate description tracking
        key = f"{user_id}:{log_date}"
        desc_tracker.setdefault(key, []).append(entry)

        # --- Flag: >12h in a single day ---
        if hours > 12:
            anomalies.append({
                "entry_id": entry_id,
                "anomaly_type": "excessive_hours",
                "severity": "high",
                "detail": f"Entry has {hours}h logged, exceeding the 12h threshold",
                "entry": entry,
            })

        # --- Flag: weekend work ---
        try:
            dt = datetime.strptime(log_date[:10], "%Y-%m-%d")
            if dt.weekday() >= 5:  # Saturday = 5, Sunday = 6
                anomalies.append({
                    "entry_id": entry_id,
                    "anomaly_type": "weekend_work",
                    "severity": "medium",
                    "detail": f"Time logged on {'Saturday' if dt.weekday() == 5 else 'Sunday'} ({log_date})",
                    "entry": entry,
                })
        except (ValueError, TypeError):
            pass

        # --- Flag: suspiciously round hours (exactly 8.0) ---
        if hours == 8.0:
            anomalies.append({
                "entry_id": entry_id,
                "anomaly_type": "round_hours",
                "severity": "low",
                "detail": "Exactly 8.0 hours logged — may be a placeholder entry",
                "entry": entry,
            })

        # --- Flag: much higher than user's average ---
        avg = user_avg.get(user_id, 0)
        if avg > 0 and hours > avg * 2 and hours > 4:
            anomalies.append({
                "entry_id": entry_id,
                "anomaly_type": "above_average",
                "severity": "medium",
                "detail": f"Entry has {hours}h, which is more than 2x user's average of {avg:.1f}h",
                "entry": entry,
            })

    # --- Flag: duplicate descriptions on the same day ---
    for key, entries in desc_tracker.items():
        if len(entries) < 2:
            continue
        seen_descs: dict[str, list[dict]] = {}
        for e in entries:
            d = e["description"].strip().lower()
            if d:
                seen_descs.setdefault(d, []).append(e)
        for d, dupes in seen_descs.items():
            if len(dupes) > 1:
                for dup in dupes:
                    anomalies.append({
                        "entry_id": dup["id"],
                        "anomaly_type": "duplicate_description",
                        "severity": "medium",
                        "detail": f"Duplicate description \"{dup['description']}\" found {len(dupes)} times on {dup['log_date']}",
                        "entry": dup,
                    })

    return {
        "tenant_id": tenant_id,
        "anomalies": anomalies,
        "total": len(anomalies),
    }


# ---------------------------------------------------------------------------
# 2. Smart Suggestions
# ---------------------------------------------------------------------------

@app.get("/api/ai/suggestions")
def smart_suggestions(user_id: str = Query(..., description="User ID")):
    """Suggest likely time entries based on past patterns.

    Analyses the user's most common projects, typical hours, and frequent
    descriptions to return the top 5 suggested entries.
    """
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM time_entries WHERE user_id = ? ORDER BY log_date DESC LIMIT 200",
            (user_id,),
        ).fetchall()
    finally:
        conn.close()

    if not rows:
        return {"user_id": user_id, "suggestions": []}

    # Analyse patterns
    project_hours: dict[str, list[float]] = {}
    desc_freq: dict[str, int] = {}
    project_descs: dict[str, list[str]] = {}

    for r in rows:
        pid = r["project_id"]
        hrs = r["hours"]
        desc = r["description"].strip()

        project_hours.setdefault(pid, []).append(hrs)

        if desc:
            desc_freq[desc] = desc_freq.get(desc, 0) + 1
            project_descs.setdefault(pid, []).append(desc)

    # Top projects by frequency
    top_projects = sorted(project_hours.keys(), key=lambda p: len(project_hours[p]), reverse=True)

    suggestions: list[dict] = []
    seen_combos: set[str] = set()

    # Build suggestions from top projects with their most common descriptions
    for pid in top_projects:
        if len(suggestions) >= 5:
            break

        hrs_list = project_hours[pid]
        avg_hours = round(sum(hrs_list) / len(hrs_list), 1)

        # Most common description for this project
        descs = project_descs.get(pid, [])
        if descs:
            desc_count: dict[str, int] = {}
            for d in descs:
                desc_count[d] = desc_count.get(d, 0) + 1
            best_desc = max(desc_count, key=desc_count.get)  # type: ignore[arg-type]
        else:
            best_desc = ""

        combo = f"{pid}:{best_desc}"
        if combo in seen_combos:
            continue
        seen_combos.add(combo)

        suggestions.append({
            "project_id": pid,
            "suggested_hours": avg_hours,
            "suggested_description": best_desc,
            "confidence": round(min(1.0, len(hrs_list) / 20), 2),
            "based_on_entries": len(hrs_list),
        })

    return {
        "user_id": user_id,
        "suggestions": suggestions[:5],
    }


# ---------------------------------------------------------------------------
# 3. NLP Time Entry Parsing
# ---------------------------------------------------------------------------

class NLPParseRequest(BaseModel):
    text: str


# Patterns for extracting structured fields from natural language
_HOURS_PATTERN = re.compile(r"(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b", re.I)
_PROJECT_PATTERN = re.compile(r"\bon\s+(.+?)(?:\s+for\s+|\s*$)", re.I)
_DESC_PATTERN = re.compile(r"\bfor\s+(.+?)(?:\s+(?:yesterday|today|last|on|this)\b|$)", re.I)

# Date word patterns
_DATE_WORDS: dict[str, int] = {
    "today": 0,
    "yesterday": -1,
}


def _parse_date_from_text(text: str) -> Optional[str]:
    """Extract a date from natural language text."""
    text_lower = text.lower()
    today = datetime.now(timezone.utc).date()

    # Check simple date words
    for word, offset in _DATE_WORDS.items():
        if word in text_lower:
            dt = today + timedelta(days=offset)
            return dt.isoformat()

    # "last monday", "last tuesday", etc.
    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    last_match = re.search(r"\blast\s+(" + "|".join(day_names) + r")\b", text_lower)
    if last_match:
        target_day_name = last_match.group(1)
        target_idx = day_names.index(target_day_name)
        current_idx = today.weekday()
        days_back = (current_idx - target_idx) % 7
        if days_back == 0:
            days_back = 7  # "last monday" when today is monday means 7 days ago
        dt = today - timedelta(days=days_back)
        return dt.isoformat()

    return None


@app.post("/api/ai/parse")
def parse_time_entry(body: NLPParseRequest):
    """Parse natural language into structured time log fields.

    Example input: "3 hours on Project Atlas for API refactoring yesterday"
    """
    text = body.text.strip()
    result: dict[str, object] = {
        "raw_text": text,
        "hours": None,
        "project_name": None,
        "description": None,
        "date": None,
    }

    # Extract hours
    hours_match = _HOURS_PATTERN.search(text)
    if hours_match:
        result["hours"] = float(hours_match.group(1))

    # Extract date
    result["date"] = _parse_date_from_text(text)

    # Extract project name ("on <project>")
    project_match = _PROJECT_PATTERN.search(text)
    if project_match:
        project_name = project_match.group(1).strip()
        # Clean trailing date words or description markers
        project_name = re.sub(
            r"\s*(?:yesterday|today|last\s+\w+|this\s+\w+).*$", "", project_name, flags=re.I
        ).strip()
        if project_name:
            result["project_name"] = project_name

    # Extract description ("for <description>")
    desc_match = _DESC_PATTERN.search(text)
    if desc_match:
        description = desc_match.group(1).strip()
        if description:
            result["description"] = description

    return result


# ---------------------------------------------------------------------------
# 4. Intelligent Weekly Digest
# ---------------------------------------------------------------------------

@app.get("/api/ai/insights/weekly")
def weekly_digest(tenant_id: str = Query(..., description="Tenant ID")):
    """Generate a narrative weekly summary for a tenant.

    Queries the local SQLite for the current and previous week's stats,
    then produces a prose summary.
    """
    today = datetime.now(timezone.utc).date()
    # Current week: Monday to Sunday
    start_of_week = today - timedelta(days=today.weekday())
    end_of_week = start_of_week + timedelta(days=6)
    # Previous week
    prev_start = start_of_week - timedelta(days=7)
    prev_end = start_of_week - timedelta(days=1)

    conn = get_db()
    try:
        # Current week entries
        current_rows = conn.execute(
            """SELECT * FROM time_entries
               WHERE tenant_id = ? AND log_date >= ? AND log_date <= ?
               ORDER BY log_date""",
            (tenant_id, start_of_week.isoformat(), end_of_week.isoformat()),
        ).fetchall()

        # Previous week entries
        prev_rows = conn.execute(
            """SELECT * FROM time_entries
               WHERE tenant_id = ? AND log_date >= ? AND log_date <= ?""",
            (tenant_id, prev_start.isoformat(), prev_end.isoformat()),
        ).fetchall()

        # All entries for billable calculation
        all_rows = conn.execute(
            "SELECT COUNT(*) as cnt FROM time_entries WHERE tenant_id = ?",
            (tenant_id,),
        ).fetchone()
    finally:
        conn.close()

    current_total_hours = sum(r["hours"] for r in current_rows)
    prev_total_hours = sum(r["hours"] for r in prev_rows)
    unique_users = len(set(r["user_id"] for r in current_rows)) if current_rows else 0

    # Top project by hours
    project_hours: dict[str, float] = {}
    for r in current_rows:
        pid = r["project_id"]
        project_hours[pid] = project_hours.get(pid, 0) + r["hours"]

    top_project = max(project_hours, key=project_hours.get) if project_hours else "N/A"  # type: ignore[arg-type]
    top_project_hours = project_hours.get(top_project, 0)

    # Week-over-week change
    if prev_total_hours > 0:
        pct_change = ((current_total_hours - prev_total_hours) / prev_total_hours) * 100
        direction = "up" if pct_change >= 0 else "down"
        change_text = f"{direction} {abs(pct_change):.0f}% from last week"
    else:
        pct_change = 0.0
        change_text = "no data from last week to compare"

    # Billable ratio (simple heuristic: entries with description are billable)
    billable_count = sum(1 for r in current_rows if r["description"].strip())
    total_count = len(current_rows)
    billable_ratio = (billable_count / total_count * 100) if total_count > 0 else 0

    # Average hours per user
    avg_per_user = (current_total_hours / unique_users) if unique_users > 0 else 0

    # Build narrative
    narrative = (
        f"Your team logged {current_total_hours:.1f} hours this week, {change_text}. "
        f"{unique_users} team member{'s' if unique_users != 1 else ''} contributed. "
        f"Top project was {top_project} with {top_project_hours:.1f} hours. "
        f"Billable ratio is {billable_ratio:.0f}%. "
        f"Average per team member: {avg_per_user:.1f} hours."
    )

    return {
        "tenant_id": tenant_id,
        "week_start": start_of_week.isoformat(),
        "week_end": end_of_week.isoformat(),
        "narrative": narrative,
        "stats": {
            "total_hours": round(current_total_hours, 1),
            "previous_week_hours": round(prev_total_hours, 1),
            "week_over_week_pct": round(pct_change, 1),
            "unique_users": unique_users,
            "total_entries": total_count,
            "top_project": top_project,
            "top_project_hours": round(top_project_hours, 1),
            "billable_ratio_pct": round(billable_ratio, 1),
            "avg_hours_per_user": round(avg_per_user, 1),
        },
    }


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8005)
