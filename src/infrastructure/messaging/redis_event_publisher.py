"""Redis Pub/Sub implementation of the EventPublisher interface.

Serialises domain events to JSON and publishes them to a Redis channel.
The notification-service (or any subscriber) listens on the same channel.
"""

from __future__ import annotations

import dataclasses
import json
import logging
import uuid
from datetime import date, datetime

import redis.asyncio as aioredis

from src.application.interfaces.event_publisher import EventPublisher
from src.domain.events.base import DomainEvent

logger = logging.getLogger(__name__)

CHANNEL = "events"


def _json_default(obj: object) -> str:
    """Handle types that json.dumps cannot serialise natively."""
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, date):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def _serialize_event(event: DomainEvent) -> str:
    """Convert a frozen dataclass domain event into a JSON string."""
    payload = {
        "event_type": type(event).__name__,
        **dataclasses.asdict(event),
    }
    return json.dumps(payload, default=_json_default)


class RedisEventPublisher(EventPublisher):
    """Publishes domain events to Redis Pub/Sub on the ``events`` channel."""

    def __init__(self, redis: aioredis.Redis) -> None:
        self._redis = redis

    async def publish(self, event: DomainEvent) -> None:
        message = _serialize_event(event)
        try:
            await self._redis.publish(CHANNEL, message)
            logger.info("Published %s to channel=%s", type(event).__name__, CHANNEL)
        except Exception:
            # Log but don't crash the request – event delivery is best-effort
            logger.exception("Failed to publish %s to Redis", type(event).__name__)
