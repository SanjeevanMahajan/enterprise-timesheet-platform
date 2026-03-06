from __future__ import annotations

import uuid
from abc import abstractmethod

from src.domain.entities.task import Task
from src.domain.repositories.base import Repository


class TaskRepository(Repository[Task]):
    @abstractmethod
    async def list_by_project(
        self,
        tenant_id: uuid.UUID,
        project_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Task]:
        ...

    @abstractmethod
    async def list_by_assignee(
        self,
        tenant_id: uuid.UUID,
        assignee_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Task]:
        ...
