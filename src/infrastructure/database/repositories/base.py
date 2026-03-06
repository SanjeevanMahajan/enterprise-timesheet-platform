from __future__ import annotations

import uuid
from typing import Generic, TypeVar

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.base import Entity
from src.infrastructure.database.models.base import Base

E = TypeVar("E", bound=Entity)
M = TypeVar("M", bound=Base)


class SQLAlchemyRepository(Generic[E, M]):
    """Base SQLAlchemy repository with common CRUD operations.

    Subclasses must implement _to_entity() and _to_model() to map between
    domain entities and SQLAlchemy models. This keeps the domain layer
    completely free of ORM dependencies.
    """

    model_class: type[M]

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def _to_entity(self, model: M) -> E:
        raise NotImplementedError

    def _to_model(self, entity: E) -> M:
        raise NotImplementedError

    async def get_by_id(self, tenant_id: uuid.UUID, entity_id: uuid.UUID) -> E | None:
        stmt = select(self.model_class).where(
            self.model_class.tenant_id == tenant_id,
            self.model_class.id == entity_id,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list(
        self,
        tenant_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[E]:
        stmt = (
            select(self.model_class)
            .where(self.model_class.tenant_id == tenant_id)
            .order_by(self.model_class.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [self._to_entity(m) for m in result.scalars().all()]

    async def add(self, entity: E) -> E:
        model = self._to_model(entity)
        self._session.add(model)
        await self._session.flush()
        return self._to_entity(model)

    async def update(self, entity: E) -> E:
        model = self._to_model(entity)
        model = await self._session.merge(model)
        await self._session.flush()
        return self._to_entity(model)

    async def delete(self, tenant_id: uuid.UUID, entity_id: uuid.UUID) -> None:
        stmt = delete(self.model_class).where(
            self.model_class.tenant_id == tenant_id,
            self.model_class.id == entity_id,
        )
        await self._session.execute(stmt)
        await self._session.flush()
