from __future__ import annotations

import uuid
from datetime import date

from src.domain.entities.base import Entity
from src.domain.exceptions import InvalidStateTransitionError
from src.domain.value_objects.enums import TimesheetStatus

_VALID_TRANSITIONS: dict[TimesheetStatus, set[TimesheetStatus]] = {
    TimesheetStatus.DRAFT: {TimesheetStatus.SUBMITTED},
    TimesheetStatus.SUBMITTED: {TimesheetStatus.APPROVED, TimesheetStatus.REJECTED},
    TimesheetStatus.APPROVED: set(),
    TimesheetStatus.REJECTED: {TimesheetStatus.DRAFT},
}


class Timesheet(Entity):
    def __init__(
        self,
        *,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        week_start: date,
        week_end: date,
        total_hours: float = 0.0,
        status: TimesheetStatus = TimesheetStatus.DRAFT,
        approved_by: uuid.UUID | None = None,
        rejection_reason: str = "",
        id: uuid.UUID | None = None,
        **kwargs,
    ) -> None:
        super().__init__(id=id, tenant_id=tenant_id, **kwargs)
        self.user_id = user_id
        self.week_start = week_start
        self.week_end = week_end
        self.total_hours = total_hours
        self.status = status
        self.approved_by = approved_by
        self.rejection_reason = rejection_reason

    def submit(self) -> None:
        self._transition_to(TimesheetStatus.SUBMITTED)

    def approve(self, approver_id: uuid.UUID) -> None:
        self._transition_to(TimesheetStatus.APPROVED)
        self.approved_by = approver_id

    def reject(self, approver_id: uuid.UUID, reason: str) -> None:
        self._transition_to(TimesheetStatus.REJECTED)
        self.approved_by = approver_id
        self.rejection_reason = reason

    def reopen(self) -> None:
        self._transition_to(TimesheetStatus.DRAFT)
        self.approved_by = None
        self.rejection_reason = ""

    def _transition_to(self, new_status: TimesheetStatus) -> None:
        allowed = _VALID_TRANSITIONS.get(self.status, set())
        if new_status not in allowed:
            raise InvalidStateTransitionError("Timesheet", self.status, new_status)
        self.status = new_status
        self.touch()
