from __future__ import annotations

import uuid
from datetime import date, datetime

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
        hourly_rate: float | None = None,
        timer_started_at: datetime | None = None,
        timer_stopped_at: datetime | None = None,
        id: uuid.UUID | None = None,
        **kwargs,
    ) -> None:
        # Timer-based entries are created with hours=0; manual entries must have hours > 0
        is_timer_based = timer_started_at is not None
        if not is_timer_based and (hours <= 0 or hours > self.MAX_DAILY_HOURS):
            raise BusinessRuleViolationError(
                f"Hours must be between 0 and {self.MAX_DAILY_HOURS}"
            )
        if is_timer_based and hours < 0:
            raise BusinessRuleViolationError("Hours cannot be negative")

        super().__init__(id=id, tenant_id=tenant_id, **kwargs)
        self.user_id = user_id
        self.project_id = project_id
        self.task_id = task_id
        self.hours = hours
        self.log_date = log_date
        self.description = description
        self.billable = billable
        self.hourly_rate = hourly_rate
        self.timer_started_at = timer_started_at
        self.timer_stopped_at = timer_stopped_at

    def update_hours(self, hours: float) -> None:
        if hours <= 0 or hours > self.MAX_DAILY_HOURS:
            raise BusinessRuleViolationError(
                f"Hours must be between 0 and {self.MAX_DAILY_HOURS}"
            )
        self.hours = hours
        self.touch()

    # ── Timer operations ─────────────────────────────────────────────────

    @property
    def is_timer_running(self) -> bool:
        return self.timer_started_at is not None and self.timer_stopped_at is None

    def start_timer(self) -> None:
        if self.timer_started_at is not None:
            raise BusinessRuleViolationError("Timer has already been started")
        self.timer_started_at = datetime.utcnow()
        self.touch()

    def stop_timer(self) -> None:
        if self.timer_started_at is None:
            raise BusinessRuleViolationError("Timer has not been started")
        if self.timer_stopped_at is not None:
            raise BusinessRuleViolationError("Timer has already been stopped")
        self.timer_stopped_at = datetime.utcnow()
        elapsed = (self.timer_stopped_at - self.timer_started_at).total_seconds()
        self.hours = round(elapsed / 3600, 2)
        self.touch()

    # ── Billing ──────────────────────────────────────────────────────────

    @property
    def billable_amount(self) -> float:
        if self.billable and self.hourly_rate is not None:
            return round(self.hours * self.hourly_rate, 2)
        return 0.0
