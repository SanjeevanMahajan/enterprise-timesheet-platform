from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from src.domain.value_objects.enums import Role
from src.infrastructure.security.jwt_handler import JWTTokenService

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
_token_service = JWTTokenService()


@dataclass(frozen=True)
class CurrentUser:
    """Represents the authenticated user extracted from the JWT token."""

    user_id: uuid.UUID
    tenant_id: uuid.UUID
    role: Role
    client_id: uuid.UUID | None = None


async def get_current_user(token: str = Depends(oauth2_scheme)) -> CurrentUser:
    """FastAPI dependency that extracts and validates the current user from JWT."""
    payload = _token_service.verify_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    raw_client_id = payload.get("client_id")
    return CurrentUser(
        user_id=uuid.UUID(payload["sub"]),
        tenant_id=uuid.UUID(payload["tenant_id"]),
        role=Role(payload["role"]),
        client_id=uuid.UUID(raw_client_id) if raw_client_id else None,
    )


def require_role(*allowed_roles: Role):
    """FastAPI dependency factory that enforces RBAC.

    Usage:
        @router.post("/projects", dependencies=[Depends(require_role(Role.ADMIN, Role.MANAGER))])
        async def create_project(...): ...
    """

    async def _check_role(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not authorized for this action",
            )
        return current_user

    return _check_role
