from __future__ import annotations

import uuid
from dataclasses import dataclass

from src.domain.events.base import DomainEvent


@dataclass(frozen=True)
class TimesheetSubmitted(DomainEvent):
    timesheet_id: uuid.UUID = uuid.UUID(int=0)
    user_id: uuid.UUID = uuid.UUID(int=0)
    total_hours: float = 0.0


@dataclass(frozen=True)
class TimesheetApproved(DomainEvent):
    timesheet_id: uuid.UUID = uuid.UUID(int=0)
    user_id: uuid.UUID = uuid.UUID(int=0)
    approved_by: uuid.UUID = uuid.UUID(int=0)


@dataclass(frozen=True)
class TimesheetRejected(DomainEvent):
    timesheet_id: uuid.UUID = uuid.UUID(int=0)
    user_id: uuid.UUID = uuid.UUID(int=0)
    rejected_by: uuid.UUID = uuid.UUID(int=0)
    reason: str = ""
