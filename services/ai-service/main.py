"""AI Assistant Service — analyses time logs and publishes insights.

Subscribes to the ``events`` channel, watches for TimeLogCreated and
TimerStopped events, runs mock-LLM analysis on descriptions, and
publishes AIInsightGenerated events back to Redis.
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
import time
import uuid
from datetime import datetime, timezone

import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CHANNEL = "events"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("ai-service")


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
# Event handling
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


# ---------------------------------------------------------------------------
# Consumer loop
# ---------------------------------------------------------------------------

WATCHED_EVENTS = {"TimeLogCreated", "TimerStopped"}


def run() -> None:
    log.info("[AI-SERVICE] Connecting to Redis at %s ...", REDIS_URL)

    while True:
        try:
            client = redis.from_url(REDIS_URL, decode_responses=True)
            client.ping()
            log.info("[AI-SERVICE] Connected. Subscribing to channel '%s'...", CHANNEL)

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
        except KeyboardInterrupt:
            log.info("[AI-SERVICE] Shutting down.")
            break


if __name__ == "__main__":
    run()
