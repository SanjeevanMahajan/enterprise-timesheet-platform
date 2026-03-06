from __future__ import annotations

import uuid
from abc import abstractmethod

from src.domain.entities.user import User
from src.domain.repositories.base import Repository


class UserRepository(Repository[User]):
    @abstractmethod
    async def get_by_email(self, tenant_id: uuid.UUID, email: str) -> User | None:
        ...

    @abstractmethod
    async def exists_by_email(self, tenant_id: uuid.UUID, email: str) -> bool:
        ...
