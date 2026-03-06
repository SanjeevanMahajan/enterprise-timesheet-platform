from __future__ import annotations

import uuid

from sqlalchemy import exists, select

from src.domain.entities.user import User
from src.domain.repositories.user_repository import UserRepository
from src.domain.value_objects.enums import Role
from src.infrastructure.database.models.user_model import UserModel
from src.infrastructure.database.repositories.base import SQLAlchemyRepository


class SQLAlchemyUserRepository(SQLAlchemyRepository[User, UserModel], UserRepository):
    model_class = UserModel

    def _to_entity(self, model: UserModel) -> User:
        return User(
            id=model.id,
            tenant_id=model.tenant_id,
            email=model.email,
            full_name=model.full_name,
            hashed_password=model.hashed_password,
            role=Role(model.role),
            is_active=model.is_active,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    def _to_model(self, entity: User) -> UserModel:
        return UserModel(
            id=entity.id,
            tenant_id=entity.tenant_id,
            email=entity.email,
            full_name=entity.full_name,
            hashed_password=entity.hashed_password,
            role=entity.role.value,
            is_active=entity.is_active,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )

    async def get_by_email(self, tenant_id: uuid.UUID, email: str) -> User | None:
        stmt = select(UserModel).where(
            UserModel.tenant_id == tenant_id,
            UserModel.email == email,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def exists_by_email(self, tenant_id: uuid.UUID, email: str) -> bool:
        stmt = select(
            exists().where(
                UserModel.tenant_id == tenant_id,
                UserModel.email == email,
            )
        )
        result = await self._session.execute(stmt)
        return result.scalar() or False
