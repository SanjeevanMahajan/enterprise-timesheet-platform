from __future__ import annotations

import uuid
from abc import abstractmethod

from src.domain.entities.project import Project
from src.domain.repositories.base import Repository
from src.domain.value_objects.enums import ProjectStatus


class ProjectRepository(Repository[Project]):
    @abstractmethod
    async def list_by_owner(
        self,
        tenant_id: uuid.UUID,
        owner_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Project]:
        ...

    @abstractmethod
    async def list_by_status(
        self,
        tenant_id: uuid.UUID,
        status: ProjectStatus,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Project]:
        ...

    @abstractmethod
    async def list_by_client(
        self,
        tenant_id: uuid.UUID,
        client_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Project]:
        ...
