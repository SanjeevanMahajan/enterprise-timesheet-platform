from __future__ import annotations

import uuid
from datetime import date

from src.domain.entities.base import Entity
from src.domain.exceptions import BusinessRuleViolationError


class TimeLog(Entity):
    MAX_DAILY_HOURS = 24.0

    def __init__(
        self,
        *,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        project_id: uuid.UUID,
        hours: float,
        log_date: date,
        task_id: uuid.UUID | None = None,
        description: str = "",
        billable: bool = True,
        id: uuid.UUID | None = None,
        **kwargs,
    ) -> None:
        if hours <= 0 or hours > self.MAX_DAILY_HOURS:
            raise BusinessRuleViolationError(
                f"Hours must be between 0 and {self.MAX_DAILY_HOURS}"
            )
        super().__init__(id=id, tenant_id=tenant_id, **kwargs)
        self.user_id = user_id
        self.project_id = project_id
        self.task_id = task_id
        self.hours = hours
        self.log_date = log_date
        self.description = description
        self.billable = billable

    def update_hours(self, hours: float) -> None:
        if hours <= 0 or hours > self.MAX_DAILY_HOURS:
            raise BusinessRuleViolationError(
                f"Hours must be between 0 and {self.MAX_DAILY_HOURS}"
            )
        self.hours = hours
        self.touch()
