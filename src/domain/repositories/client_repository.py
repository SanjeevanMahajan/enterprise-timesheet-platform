from __future__ import annotations

import uuid
from abc import abstractmethod

from src.domain.entities.client import Client
from src.domain.repositories.base import Repository


class ClientRepository(Repository[Client]):
    @abstractmethod
    async def list_by_name(
        self,
        tenant_id: uuid.UUID,
        name_contains: str,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Client]:
        ...
