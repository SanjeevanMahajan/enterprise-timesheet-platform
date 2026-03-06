from __future__ import annotations

import uuid
from abc import abstractmethod
from datetime import date

from src.domain.entities.time_log import TimeLog
from src.domain.repositories.base import Repository


class TimeLogRepository(Repository[TimeLog]):
    @abstractmethod
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
        ...

    @abstractmethod
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
        ...

    @abstractmethod
    async def sum_hours_for_user_on_date(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        log_date: date,
    ) -> float:
        ...
