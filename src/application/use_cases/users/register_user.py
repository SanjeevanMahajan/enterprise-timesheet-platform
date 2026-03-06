from __future__ import annotations

import uuid
from abc import ABC, abstractmethod

from src.application.dto.user_dto import CreateUserRequest, UserResponse
from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.user import User
from src.domain.exceptions import DuplicateEntityError


class PasswordHasher(ABC):
    @abstractmethod
    def hash(self, password: str) -> str: ...

    @abstractmethod
    def verify(self, password: str, hashed: str) -> bool: ...


class RegisterUserUseCase:
    def __init__(self, uow: UnitOfWork, hasher: PasswordHasher) -> None:
        self._uow = uow
        self._hasher = hasher

    async def execute(
        self,
        tenant_id: uuid.UUID,
        request: CreateUserRequest,
    ) -> UserResponse:
        async with self._uow:
            if await self._uow.users.exists_by_email(tenant_id, request.email):
                raise DuplicateEntityError("User", "email", request.email)

            user = User(
                tenant_id=tenant_id,
                email=request.email,
                full_name=request.full_name,
                hashed_password=self._hasher.hash(request.password),
                role=request.role,
            )

            user = await self._uow.users.add(user)
            await self._uow.commit()

        return UserResponse(
            id=user.id,
            tenant_id=user.tenant_id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )
