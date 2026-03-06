from __future__ import annotations

import uuid
from abc import abstractmethod
from datetime import date

from src.domain.entities.timesheet import Timesheet
from src.domain.repositories.base import Repository
from src.domain.value_objects.enums import TimesheetStatus


class TimesheetRepository(Repository[Timesheet]):
    @abstractmethod
    async def get_by_user_and_week(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        week_start: date,
    ) -> Timesheet | None:
        ...

    @abstractmethod
    async def list_by_user(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Timesheet]:
        ...

    @abstractmethod
    async def list_pending_approval(
        self,
        tenant_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Timesheet]:
        ...
