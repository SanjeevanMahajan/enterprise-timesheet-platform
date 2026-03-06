from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from src.domain.entities.base import Entity

T = TypeVar("T", bound=Entity)


class Repository(ABC, Generic[T]):
    """Abstract base repository enforcing tenant-scoped CRUD operations.

    Every query method requires tenant_id to guarantee tenant isolation at
    the repository contract level — not just the implementation.
    """

    @abstractmethod
    async def get_by_id(self, tenant_id: uuid.UUID, entity_id: uuid.UUID) -> T | None:
        ...

    @abstractmethod
    async def list(
        self,
        tenant_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[T]:
        ...

    @abstractmethod
    async def add(self, entity: T) -> T:
        ...

    @abstractmethod
    async def update(self, entity: T) -> T:
        ...

    @abstractmethod
    async def delete(self, tenant_id: uuid.UUID, entity_id: uuid.UUID) -> None:
        ...
