"""In-memory repository implementations for testing.

These fakes implement the full repository contracts using plain dicts,
so tests exercise real filtering/aggregation logic without a database.
"""

from __future__ import annotations

import uuid
from datetime import date

from src.domain.entities.base import Entity
from src.domain.entities.project import Project
from src.domain.entities.task import Task
from src.domain.entities.time_log import TimeLog
from src.domain.entities.timesheet import Timesheet
from src.domain.entities.user import User
from src.domain.repositories.project_repository import ProjectRepository
from src.domain.repositories.task_repository import TaskRepository
from src.domain.repositories.time_log_repository import TimeLogRepository
from src.domain.repositories.timesheet_repository import TimesheetRepository
from src.domain.repositories.user_repository import UserRepository
from src.domain.value_objects.enums import ProjectStatus, TimesheetStatus


class InMemoryRepository:
    """Base in-memory storage with tenant-scoped CRUD."""

    def __init__(self) -> None:
        self._store: dict[uuid.UUID, Entity] = {}

    async def get_by_id(self, tenant_id: uuid.UUID, entity_id: uuid.UUID):
        entity = self._store.get(entity_id)
        if entity and entity.tenant_id == tenant_id:
            return entity
        return None

    async def list(self, tenant_id: uuid.UUID, *, offset: int = 0, limit: int = 50):
        items = [e for e in self._store.values() if e.tenant_id == tenant_id]
        return items[offset : offset + limit]

    async def add(self, entity):
        self._store[entity.id] = entity
        return entity

    async def update(self, entity):
        self._store[entity.id] = entity
        return entity

    async def delete(self, tenant_id: uuid.UUID, entity_id: uuid.UUID) -> None:
        entity = self._store.get(entity_id)
        if entity and entity.tenant_id == tenant_id:
            del self._store[entity_id]


class FakeUserRepository(InMemoryRepository, UserRepository):
    async def get_by_email(self, tenant_id: uuid.UUID, email: str) -> User | None:
        for user in self._store.values():
            if isinstance(user, User) and user.tenant_id == tenant_id and user.email == email:
                return user
        return None

    async def exists_by_email(self, tenant_id: uuid.UUID, email: str) -> bool:
        return await self.get_by_email(tenant_id, email) is not None


class FakeProjectRepository(InMemoryRepository, ProjectRepository):
    async def list_by_owner(
        self, tenant_id: uuid.UUID, owner_id: uuid.UUID, *, offset: int = 0, limit: int = 50
    ) -> list[Project]:
        items = [
            p for p in self._store.values()
            if isinstance(p, Project) and p.tenant_id == tenant_id and p.owner_id == owner_id
        ]
        return items[offset : offset + limit]

    async def list_by_status(
        self, tenant_id: uuid.UUID, status: ProjectStatus, *, offset: int = 0, limit: int = 50
    ) -> list[Project]:
        items = [
            p for p in self._store.values()
            if isinstance(p, Project) and p.tenant_id == tenant_id and p.status == status
        ]
        return items[offset : offset + limit]


class FakeTaskRepository(InMemoryRepository, TaskRepository):
    async def list_by_project(
        self, tenant_id: uuid.UUID, project_id: uuid.UUID, *, offset: int = 0, limit: int = 50
    ) -> list[Task]:
        items = [
            t for t in self._store.values()
            if isinstance(t, Task) and t.tenant_id == tenant_id and t.project_id == project_id
        ]
        return items[offset : offset + limit]

    async def list_by_assignee(
        self, tenant_id: uuid.UUID, assignee_id: uuid.UUID, *, offset: int = 0, limit: int = 50
    ) -> list[Task]:
        items = [
            t for t in self._store.values()
            if isinstance(t, Task) and t.tenant_id == tenant_id and t.assignee_id == assignee_id
        ]
        return items[offset : offset + limit]


class FakeTimeLogRepository(InMemoryRepository, TimeLogRepository):
    async def list_by_user(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        *,
        start_date: date | None = None,
        end_date: date | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[TimeLog]:
        items = [
            tl for tl in self._store.values()
            if isinstance(tl, TimeLog) and tl.tenant_id == tenant_id and tl.user_id == user_id
        ]
        if start_date:
            items = [tl for tl in items if tl.log_date >= start_date]
        if end_date:
            items = [tl for tl in items if tl.log_date <= end_date]
        return items[offset : offset + limit]

    async def list_by_project(
        self,
        tenant_id: uuid.UUID,
        project_id: uuid.UUID,
        *,
        start_date: date | None = None,
        end_date: date | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[TimeLog]:
        items = [
            tl for tl in self._store.values()
            if isinstance(tl, TimeLog)
            and tl.tenant_id == tenant_id
            and tl.project_id == project_id
        ]
        if start_date:
            items = [tl for tl in items if tl.log_date >= start_date]
        if end_date:
            items = [tl for tl in items if tl.log_date <= end_date]
        return items[offset : offset + limit]

    async def sum_hours_for_user_on_date(
        self, tenant_id: uuid.UUID, user_id: uuid.UUID, log_date: date
    ) -> float:
        return sum(
            tl.hours
            for tl in self._store.values()
            if isinstance(tl, TimeLog)
            and tl.tenant_id == tenant_id
            and tl.user_id == user_id
            and tl.log_date == log_date
        )


class FakeTimesheetRepository(InMemoryRepository, TimesheetRepository):
    async def get_by_user_and_week(
        self, tenant_id: uuid.UUID, user_id: uuid.UUID, week_start: date
    ) -> Timesheet | None:
        for ts in self._store.values():
            if (
                isinstance(ts, Timesheet)
                and ts.tenant_id == tenant_id
                and ts.user_id == user_id
                and ts.week_start == week_start
            ):
                return ts
        return None

    async def list_by_user(
        self, tenant_id: uuid.UUID, user_id: uuid.UUID, *, offset: int = 0, limit: int = 50
    ) -> list[Timesheet]:
        items = [
            ts for ts in self._store.values()
            if isinstance(ts, Timesheet) and ts.tenant_id == tenant_id and ts.user_id == user_id
        ]
        return items[offset : offset + limit]

    async def list_pending_approval(
        self, tenant_id: uuid.UUID, *, offset: int = 0, limit: int = 50
    ) -> list[Timesheet]:
        items = [
            ts for ts in self._store.values()
            if isinstance(ts, Timesheet)
            and ts.tenant_id == tenant_id
            and ts.status == TimesheetStatus.SUBMITTED
        ]
        return items[offset : offset + limit]
