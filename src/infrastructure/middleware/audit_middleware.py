"""Audit trail middleware that logs mutating API requests to the audit_logs table.

POST, PUT, and DELETE requests are captured asynchronously so that the response
is never blocked by the audit write.  The actor is extracted from the JWT token
when present; unauthenticated requests are not audited.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

from fastapi import Request, Response
from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from src.infrastructure.config.settings import settings
from src.infrastructure.database.models.audit_log_model import AuditLogModel
from src.infrastructure.database.session import async_session_factory

logger = logging.getLogger(__name__)

_AUDITABLE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

_METHOD_TO_ACTION: dict[str, str] = {
    "POST": "create",
    "PUT": "update",
    "PATCH": "update",
    "DELETE": "delete",
}


def _extract_resource_type(path: str) -> str:
    """Derive a resource type name from the URL path.

    Example: ``/api/v1/projects/abc-123`` -> ``projects``
    """
    parts = [p for p in path.strip("/").split("/") if p]
    # Skip prefix segments like "api", "v1"
    for i, part in enumerate(parts):
        if part not in ("api", "v1", "v2"):
            return part
    return parts[-1] if parts else "unknown"


def _extract_resource_id(path: str) -> uuid.UUID | None:
    """Try to find a UUID segment in the URL path (resource identifier)."""
    for part in reversed(path.strip("/").split("/")):
        try:
            return uuid.UUID(part)
        except ValueError:
            continue
    return None


def _decode_actor(request: Request) -> tuple[uuid.UUID | None, uuid.UUID | None]:
    """Return (actor_id, tenant_id) from the Authorization header, or (None, None)."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, None
    token = auth_header[7:]
    try:
        payload: dict[str, Any] = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        actor_id = uuid.UUID(payload["sub"])
        tenant_id = uuid.UUID(payload["tenant_id"])
        return actor_id, tenant_id
    except (JWTError, KeyError, ValueError):
        return None, None


async def _persist_audit_log(
    tenant_id: uuid.UUID,
    actor_id: uuid.UUID,
    action: str,
    resource_type: str,
    resource_id: uuid.UUID,
    details: dict[str, Any],
) -> None:
    """Write an audit log row in a standalone session (fire-and-forget)."""
    try:
        async with async_session_factory() as session:
            log_entry = AuditLogModel(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                actor_id=actor_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                details=details,
            )
            session.add(log_entry)
            await session.commit()
    except Exception:
        logger.exception("Failed to persist audit log entry")


class AuditMiddleware(BaseHTTPMiddleware):
    """Logs POST/PUT/PATCH/DELETE requests to the audit_logs table asynchronously."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)

        if request.method not in _AUDITABLE_METHODS:
            return response

        actor_id, tenant_id = _decode_actor(request)
        if actor_id is None or tenant_id is None:
            return response

        action = _METHOD_TO_ACTION.get(request.method, request.method.lower())
        resource_type = _extract_resource_type(request.url.path)
        resource_id = _extract_resource_id(request.url.path) or uuid.uuid4()

        details: dict[str, Any] = {
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
        }

        # Fire-and-forget: don't await in the request path
        asyncio.create_task(
            _persist_audit_log(
                tenant_id=tenant_id,
                actor_id=actor_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                details=details,
            )
        )

        return response
