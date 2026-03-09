"""API Key authentication dependency for the public API.

Provides an alternative to JWT-based auth.  Clients include their key in the
``X-API-Key`` header.  The dependency hashes the key with SHA-256 and looks it
up in the ``api_keys`` table.  On success a :class:`CurrentApiKey` is returned
containing the tenant and granted scopes.
"""

from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from datetime import datetime

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.infrastructure.database.models.api_key_model import ApiKeyModel
from src.infrastructure.database.session import get_session

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


@dataclass(frozen=True)
class CurrentApiKey:
    """Represents the authenticated API key context."""

    api_key_id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    scopes: list[str]


def _hash_key(raw_key: str) -> str:
    """SHA-256 hash of the raw API key."""
    return hashlib.sha256(raw_key.encode()).hexdigest()


async def get_current_api_key(
    api_key: str | None = Security(_api_key_header),
    session: AsyncSession = Depends(get_session),
) -> CurrentApiKey:
    """FastAPI dependency that validates an API key from the X-API-Key header."""
    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key",
        )

    key_hash = _hash_key(api_key)

    stmt = select(ApiKeyModel).where(
        ApiKeyModel.key_hash == key_hash,
        ApiKeyModel.is_active.is_(True),
    )
    result = await session.execute(stmt)
    model = result.scalar_one_or_none()

    if model is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key",
        )

    # Update last_used_at asynchronously
    await session.execute(
        update(ApiKeyModel)
        .where(ApiKeyModel.id == model.id)
        .values(last_used_at=datetime.utcnow())
    )
    await session.commit()

    return CurrentApiKey(
        api_key_id=model.id,
        tenant_id=model.tenant_id,
        name=model.name,
        scopes=list(model.scopes),
    )


def require_scope(*required_scopes: str):
    """FastAPI dependency factory that enforces API key scopes.

    Usage:
        @router.get("/data", dependencies=[Depends(require_scope("read:projects"))])
        async def get_data(...): ...
    """

    async def _check_scope(
        current_key: CurrentApiKey = Depends(get_current_api_key),
    ) -> CurrentApiKey:
        for scope in required_scopes:
            if scope not in current_key.scopes:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"API key missing required scope: {scope}",
                )
        return current_key

    return _check_scope
