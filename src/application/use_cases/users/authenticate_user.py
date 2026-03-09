from __future__ import annotations

import uuid
from abc import ABC, abstractmethod

from src.application.dto.user_dto import AuthRequest, TokenResponse
from src.application.interfaces.unit_of_work import UnitOfWork
from src.application.use_cases.users.register_user import PasswordHasher
from src.domain.exceptions import AuthorizationError


class TokenService(ABC):
    @abstractmethod
    def create_access_token(
        self, user_id: uuid.UUID, tenant_id: uuid.UUID, role: str, client_id: uuid.UUID | None = None
    ) -> str: ...

    @abstractmethod
    def create_refresh_token(self, user_id: uuid.UUID, tenant_id: uuid.UUID) -> str: ...


class AuthenticateUserUseCase:
    def __init__(
        self,
        uow: UnitOfWork,
        hasher: PasswordHasher,
        tokens: TokenService,
    ) -> None:
        self._uow = uow
        self._hasher = hasher
        self._tokens = tokens

    async def execute(
        self,
        tenant_id: uuid.UUID,
        request: AuthRequest,
    ) -> TokenResponse:
        async with self._uow:
            user = await self._uow.users.get_by_email(tenant_id, request.email)

        if user is None or not self._hasher.verify(request.password, user.hashed_password):
            raise AuthorizationError("authenticate", "user credentials")

        if not user.is_active:
            raise AuthorizationError("login", "deactivated account")

        return TokenResponse(
            access_token=self._tokens.create_access_token(
                user.id, user.tenant_id, user.role, user.client_id
            ),
            refresh_token=self._tokens.create_refresh_token(
                user.id, user.tenant_id
            ),
            role=user.role,
            client_id=user.client_id,
        )
