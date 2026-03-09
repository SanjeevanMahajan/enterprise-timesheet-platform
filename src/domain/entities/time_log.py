from __future__ import annotations

import uuid
from datetime import date, datetime

from src.domain.entities.base import Entity
from src.domain.exceptions import BusinessRuleViolationError
from src.domain.value_objects.enums import ApprovalStatus, TimerStatus


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
        timer_status: TimerStatus = TimerStatus.IDLE,
        accumulated_seconds: int = 0,
        approval_status: ApprovalStatus = ApprovalStatus.DRAFT,
        timesheet_id: uuid.UUID | None = None,
        id: uuid.UUID | None = None,
        **kwargs,
    ) -> None:
        # Timer-based entries are created with hours=0; manual entries must have hours > 0
        is_timer_based = timer_started_at is not None or timer_status != TimerStatus.IDLE
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
        self.timer_status = timer_status
        self.accumulated_seconds = accumulated_seconds
        self.approval_status = approval_status
        self.timesheet_id = timesheet_id
        self.ai_category: str | None = None
        self.ai_quality_score: int | None = None
        self.ai_suggestion: str | None = None

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
        return self.timer_status == TimerStatus.RUNNING

    @property
    def is_timer_paused(self) -> bool:
        return self.timer_status == TimerStatus.PAUSED

    def start_timer(self) -> None:
        if self.timer_status != TimerStatus.IDLE:
            raise BusinessRuleViolationError("Timer has already been started")
        self.timer_started_at = datetime.utcnow()
        self.timer_status = TimerStatus.RUNNING
        self.touch()

    def pause_timer(self) -> None:
        if self.timer_status != TimerStatus.RUNNING:
            raise BusinessRuleViolationError("Timer is not running")
        now = datetime.utcnow()
        elapsed = int((now - self.timer_started_at).total_seconds())
        self.accumulated_seconds += elapsed
        self.timer_started_at = None
        self.timer_status = TimerStatus.PAUSED
        self.hours = round(self.accumulated_seconds / 3600, 2)
        self.touch()

    def resume_timer(self) -> None:
        if self.timer_status != TimerStatus.PAUSED:
            raise BusinessRuleViolationError("Timer is not paused")
        self.timer_started_at = datetime.utcnow()
        self.timer_status = TimerStatus.RUNNING
        self.touch()

    def stop_timer(self) -> None:
        if self.timer_status == TimerStatus.COMPLETED:
            raise BusinessRuleViolationError("Timer has already been stopped")
        if self.timer_status == TimerStatus.IDLE:
            raise BusinessRuleViolationError("Timer has not been started")

        now = datetime.utcnow()
        # If running, accumulate the final segment
        if self.timer_status == TimerStatus.RUNNING and self.timer_started_at:
            elapsed = int((now - self.timer_started_at).total_seconds())
            self.accumulated_seconds += elapsed

        self.timer_stopped_at = now
        self.timer_status = TimerStatus.COMPLETED
        self.hours = round(self.accumulated_seconds / 3600, 2)
        self.approval_status = ApprovalStatus.PENDING_MANAGER
        self.touch()

    # ── Approval operations ──────────────────────────────────────────────

    def approve(self) -> None:
        if self.approval_status not in (ApprovalStatus.PENDING_MANAGER, ApprovalStatus.REJECTED):
            raise BusinessRuleViolationError(
                f"Cannot approve a time log with status '{self.approval_status}'"
            )
        self.approval_status = ApprovalStatus.APPROVED
        self.touch()

    def reject(self, reason: str = "") -> None:
        if self.approval_status != ApprovalStatus.PENDING_MANAGER:
            raise BusinessRuleViolationError(
                f"Cannot reject a time log with status '{self.approval_status}'"
            )
        self.approval_status = ApprovalStatus.REJECTED
        self.touch()

    # ── Billing ──────────────────────────────────────────────────────────

    @property
    def billable_amount(self) -> float:
        if self.billable and self.hourly_rate is not None:
            return round(self.hours * self.hourly_rate, 2)
        return 0.0
