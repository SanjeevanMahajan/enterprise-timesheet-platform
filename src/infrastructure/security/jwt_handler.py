from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any

from jose import JWTError, jwt

from src.application.use_cases.users.authenticate_user import TokenService
from src.infrastructure.config.settings import settings


class JWTTokenService(TokenService):
    """Creates and verifies JWT tokens for authentication.

    Access tokens carry user_id, tenant_id, and role — enabling
    RBAC + tenant isolation on every request without a DB lookup.
    Refresh tokens carry only identity info for token renewal.
    """

    def __init__(
        self,
        secret_key: str = settings.jwt_secret_key,
        algorithm: str = settings.jwt_algorithm,
        access_expire_minutes: int = settings.access_token_expire_minutes,
        refresh_expire_days: int = settings.refresh_token_expire_days,
    ) -> None:
        self._secret_key = secret_key
        self._algorithm = algorithm
        self._access_expire_minutes = access_expire_minutes
        self._refresh_expire_days = refresh_expire_days

    def create_access_token(
        self,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID,
        role: str,
        client_id: uuid.UUID | None = None,
    ) -> str:
        expires = datetime.utcnow() + timedelta(minutes=self._access_expire_minutes)
        payload: dict[str, Any] = {
            "sub": str(user_id),
            "tenant_id": str(tenant_id),
            "role": role,
            "type": "access",
            "exp": expires,
        }
        if client_id is not None:
            payload["client_id"] = str(client_id)
        return jwt.encode(payload, self._secret_key, algorithm=self._algorithm)

    def create_refresh_token(
        self, user_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> str:
        expires = datetime.utcnow() + timedelta(days=self._refresh_expire_days)
        payload = {
            "sub": str(user_id),
            "tenant_id": str(tenant_id),
            "type": "refresh",
            "exp": expires,
        }
        return jwt.encode(payload, self._secret_key, algorithm=self._algorithm)

    def decode_token(self, token: str) -> dict[str, Any]:
        """Decode and validate a JWT token. Raises JWTError on failure."""
        return jwt.decode(token, self._secret_key, algorithms=[self._algorithm])

    def verify_access_token(self, token: str) -> dict[str, Any] | None:
        """Verify an access token and return its payload, or None if invalid."""
        try:
            payload = self.decode_token(token)
            if payload.get("type") != "access":
                return None
            return payload
        except JWTError:
            return None
