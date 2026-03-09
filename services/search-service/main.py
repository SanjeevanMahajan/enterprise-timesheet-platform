"""Search & Discovery Service — indexes domain events into Meilisearch for instant search.

Dual-protocol service:
  - Redis Pub/Sub subscriber (write path) — indexes documents from domain events
  - FastAPI HTTP API (read path) — unified multi-index search endpoint

Listens for:
  - ProjectCreated     → indexes project into "projects" index
  - TimeLogApproved    → indexes time log into "timelogs" index
  - InvoiceGenerated   → indexes invoice into "invoices" index

Search: GET /api/search?q={query} returns grouped results across all indexes.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import threading
import time
from contextlib import asynccontextmanager

import meilisearch
import redis
import uvicorn
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CHANNEL = "events"
MEILI_URL = os.getenv("MEILI_URL", "http://localhost:7700")
MEILI_KEY = os.getenv("MEILI_MASTER_KEY", "")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("search-service")


# ---------------------------------------------------------------------------
# Meilisearch client
# ---------------------------------------------------------------------------

def get_meili() -> meilisearch.Client:
    return meilisearch.Client(MEILI_URL, MEILI_KEY)


def init_indexes(client: meilisearch.Client) -> None:
    """Ensure indexes exist with the correct searchable attributes and settings."""
    indexes = {
        "projects": {
            "searchableAttributes": ["name", "project_id", "owner_id", "tenant_id"],
            "displayedAttributes": ["*"],
            "filterableAttributes": ["tenant_id"],
        },
        "timelogs": {
            "searchableAttributes": ["description", "user_id", "project_id"],
            "displayedAttributes": ["*"],
            "filterableAttributes": ["tenant_id", "project_id", "user_id"],
            "sortableAttributes": ["log_date", "hours"],
        },
        "invoices": {
            "searchableAttributes": ["invoice_id", "tenant_id"],
            "displayedAttributes": ["*"],
            "filterableAttributes": ["tenant_id", "status"],
            "sortableAttributes": ["total", "created_at"],
        },
    }

    for name, settings in indexes.items():
        try:
            client.create_index(name, {"primaryKey": "id"})
        except meilisearch.errors.MeilisearchApiError:
            pass  # Index already exists

        idx = client.index(name)
        idx.update_searchable_attributes(settings["searchableAttributes"])
        idx.update_displayed_attributes(settings["displayedAttributes"])
        idx.update_filterable_attributes(settings.get("filterableAttributes", []))
        if "sortableAttributes" in settings:
            idx.update_sortable_attributes(settings["sortableAttributes"])

        log.info("[SEARCH] Index '%s' configured.", name)


# ---------------------------------------------------------------------------
# Event handlers — index documents
# ---------------------------------------------------------------------------

def handle_project_created(meili: meilisearch.Client, data: dict) -> None:
    project_id = data.get("project_id", "")
    doc = {
        "id": str(project_id),
        "type": "project",
        "project_id": str(project_id),
        "name": data.get("name", ""),
        "owner_id": str(data.get("owner_id", "")),
        "tenant_id": str(data.get("tenant_id", "")),
    }
    meili.index("projects").add_documents([doc])
    log.info("[SEARCH] Indexed project %s — \"%s\"", str(project_id)[:8], doc["name"])


def handle_time_log_approved(meili: meilisearch.Client, data: dict) -> None:
    time_log_id = data.get("time_log_id", "")
    hours = float(data.get("hours", 0))
    description = data.get("description", "")
    doc = {
        "id": str(time_log_id),
        "type": "timelog",
        "time_log_id": str(time_log_id),
        "user_id": str(data.get("user_id", "")),
        "project_id": str(data.get("project_id", "")),
        "tenant_id": str(data.get("tenant_id", "")),
        "hours": hours,
        "log_date": str(data.get("log_date", "")),
        "description": description,
        "billable": data.get("billable", True),
        "hourly_rate": data.get("hourly_rate"),
    }
    meili.index("timelogs").add_documents([doc])
    log.info(
        "[SEARCH] Indexed timelog %s — %.1fh \"%s\"",
        str(time_log_id)[:8], hours, description[:40],
    )


def handle_invoice_generated(meili: meilisearch.Client, data: dict) -> None:
    invoice_id = data.get("invoice_id", "")
    doc = {
        "id": str(invoice_id),
        "type": "invoice",
        "invoice_id": str(invoice_id),
        "tenant_id": str(data.get("tenant_id", "")),
        "total": float(data.get("total", 0)),
        "line_item_count": int(data.get("line_item_count", 0)),
        "line_item_ids": data.get("line_item_ids", []),
        "payment_url": data.get("payment_url"),
        "status": "unpaid",
        "created_at": data.get("occurred_at", ""),
    }
    meili.index("invoices").add_documents([doc])
    log.info("[SEARCH] Indexed invoice %s — $%.2f", str(invoice_id)[:8], doc["total"])


# ---------------------------------------------------------------------------
# Redis subscriber (background thread)
# ---------------------------------------------------------------------------

WATCHED_EVENTS = {"ProjectCreated", "TimeLogApproved", "InvoiceGenerated"}


def redis_subscriber_loop(meili: meilisearch.Client) -> None:
    log.info("[SEARCH] Redis subscriber thread starting...")

    while True:
        try:
            client = redis.from_url(REDIS_URL, decode_responses=True)
            client.ping()
            log.info("[SEARCH] Connected to Redis. Subscribing to '%s'...", CHANNEL)

            pubsub = client.pubsub()
            pubsub.subscribe(CHANNEL)

            for message in pubsub.listen():
                if message["type"] != "message":
                    continue

                try:
                    data = json.loads(message["data"])
                except json.JSONDecodeError:
                    log.warning("[SEARCH] Invalid JSON: %s", message["data"])
                    continue

                event_type = data.get("event_type", "Unknown")

                if event_type == "ProjectCreated":
                    handle_project_created(meili, data)
                elif event_type == "TimeLogApproved":
                    handle_time_log_approved(meili, data)
                elif event_type == "InvoiceGenerated":
                    handle_invoice_generated(meili, data)
                else:
                    log.debug("[SEARCH] Ignoring event: %s", event_type)

        except redis.ConnectionError:
            log.warning("[SEARCH] Redis connection lost. Reconnecting in 3s...")
            time.sleep(3)
        except Exception:
            log.exception("[SEARCH] Unexpected error in subscriber. Retrying in 3s...")
            time.sleep(3)


# ---------------------------------------------------------------------------
# FastAPI HTTP API (read path)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(_app: FastAPI):
    meili = get_meili()

    # Wait for Meilisearch to become available
    for attempt in range(30):
        try:
            meili.health()
            log.info("[SEARCH] Meilisearch is healthy.")
            break
        except Exception:
            log.info("[SEARCH] Waiting for Meilisearch... (attempt %d/30)", attempt + 1)
            time.sleep(2)
    else:
        log.error("[SEARCH] Meilisearch not available after 60s. Starting anyway...")

    init_indexes(meili)

    thread = threading.Thread(target=redis_subscriber_loop, args=(meili,), daemon=True)
    thread.start()
    log.info("[SEARCH] HTTP API ready on port 8003")
    yield


app = FastAPI(title="Search & Discovery Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/search")
def search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(10, ge=1, le=50),
):
    """Unified search across projects, time logs, and invoices.

    Returns results grouped by type with relevance ranking.
    """
    meili = get_meili()
    results: dict[str, list] = {
        "projects": [],
        "timelogs": [],
        "invoices": [],
    }

    for index_name in results:
        try:
            response = meili.index(index_name).search(q, {"limit": limit})
            results[index_name] = response.get("hits", [])
        except Exception as e:
            log.warning("[SEARCH] Failed to search index '%s': %s", index_name, e)

    total = sum(len(v) for v in results.values())

    return {
        "query": q,
        "total_hits": total,
        "results": results,
    }


@app.get("/health")
def health():
    try:
        meili = get_meili()
        meili.health()
        return {"status": "ok", "meilisearch": "healthy"}
    except Exception:
        return {"status": "degraded", "meilisearch": "unreachable"}


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)
