"""Redis-based token-bucket rate limiter middleware.

Limits are applied per-user (JWT ``sub`` claim) for authenticated requests and
per-IP for unauthenticated requests.  When the bucket is exhausted a ``429 Too
Many Requests`` response is returned with a ``Retry-After`` header.

Default limits:
  - Authenticated:   100 requests / 60 seconds
  - Unauthenticated:  20 requests / 60 seconds
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

import redis.asyncio as aioredis
from fastapi import Request, Response
from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse

from src.infrastructure.config.settings import settings

logger = logging.getLogger(__name__)

# Tunables
AUTHENTICATED_LIMIT = 100
UNAUTHENTICATED_LIMIT = 20
WINDOW_SECONDS = 60


def _get_client_identity(request: Request) -> tuple[str, int]:
    """Return ``(identity_key, max_requests)`` for a given request.

    Authenticated users are identified by JWT ``sub``; anonymous clients by IP.
    """
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            payload: dict[str, Any] = jwt.decode(
                token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
            )
            user_id = payload.get("sub", "")
            return f"rl:user:{user_id}", AUTHENTICATED_LIMIT
        except (JWTError, KeyError, ValueError):
            pass

    # Also check X-API-Key header for API key authenticated requests
    api_key = request.headers.get("x-api-key", "")
    if api_key:
        return f"rl:apikey:{api_key[:16]}", AUTHENTICATED_LIMIT

    client_ip = request.client.host if request.client else "unknown"
    return f"rl:ip:{client_ip}", UNAUTHENTICATED_LIMIT


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """Token-bucket rate limiter backed by Redis."""

    def __init__(self, app: Any) -> None:
        super().__init__(app)
        redis_url = os.getenv("REDIS_URL", settings.redis_url)
        self._redis: aioredis.Redis = aioredis.from_url(
            redis_url, decode_responses=True
        )

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        identity_key, max_requests = _get_client_identity(request)

        try:
            current_count = await self._redis.incr(identity_key)
            if current_count == 1:
                await self._redis.expire(identity_key, WINDOW_SECONDS)

            ttl = await self._redis.ttl(identity_key)
            if ttl < 0:
                ttl = WINDOW_SECONDS

            if current_count > max_requests:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please try again later."},
                    headers={
                        "Retry-After": str(ttl),
                        "X-RateLimit-Limit": str(max_requests),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(int(time.time()) + ttl),
                    },
                )

            response = await call_next(request)
            response.headers["X-RateLimit-Limit"] = str(max_requests)
            response.headers["X-RateLimit-Remaining"] = str(
                max(0, max_requests - current_count)
            )
            response.headers["X-RateLimit-Reset"] = str(int(time.time()) + ttl)
            return response

        except aioredis.RedisError:
            # If Redis is unavailable, allow the request through (fail open)
            logger.warning("Rate limiter: Redis unavailable, allowing request through")
            return await call_next(request)
