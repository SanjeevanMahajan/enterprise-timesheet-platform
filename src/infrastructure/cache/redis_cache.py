"""Async Redis cache helper.

Provides a thin wrapper around Redis GET / SET / DEL with JSON serialisation
and TTL support.  All operations are best-effort: failures are logged but never
propagated to callers so the application degrades gracefully when Redis is
unavailable.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


class RedisCache:
    """Simple async cache backed by Redis."""

    def __init__(self, redis: aioredis.Redis) -> None:
        self._redis = redis

    async def cache_get(self, key: str) -> Any | None:
        """Return the cached value for *key*, or ``None`` on miss / error."""
        try:
            raw = await self._redis.get(key)
            if raw is None:
                return None
            return json.loads(raw)
        except (aioredis.RedisError, json.JSONDecodeError):
            logger.warning("cache_get failed for key=%s", key)
            return None

    async def cache_set(self, key: str, value: Any, ttl: int = 60) -> None:
        """Store *value* under *key* with an expiry of *ttl* seconds."""
        try:
            raw = json.dumps(value, default=str)
            await self._redis.set(key, raw, ex=ttl)
        except (aioredis.RedisError, TypeError):
            logger.warning("cache_set failed for key=%s", key)

    async def cache_invalidate(self, key: str) -> None:
        """Delete *key* from the cache."""
        try:
            await self._redis.delete(key)
        except aioredis.RedisError:
            logger.warning("cache_invalidate failed for key=%s", key)

    async def cache_invalidate_pattern(self, pattern: str) -> None:
        """Delete all keys matching *pattern* (e.g. ``projects:tenant:*``)."""
        try:
            cursor = 0
            while True:
                cursor, keys = await self._redis.scan(
                    cursor=cursor, match=pattern, count=100
                )
                if keys:
                    await self._redis.delete(*keys)
                if cursor == 0:
                    break
        except aioredis.RedisError:
            logger.warning("cache_invalidate_pattern failed for pattern=%s", pattern)
