from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date

from src.domain.events.base import DomainEvent


@dataclass(frozen=True)
class TimeLogCreated(DomainEvent):
    time_log_id: uuid.UUID = uuid.UUID(int=0)
    user_id: uuid.UUID = uuid.UUID(int=0)
    project_id: uuid.UUID = uuid.UUID(int=0)
    hours: float = 0.0
    log_date: date = date.min
    description: str = ""
    billable: bool = True
    hourly_rate: float | None = None


@dataclass(frozen=True)
class TimerStarted(DomainEvent):
    time_log_id: uuid.UUID = uuid.UUID(int=0)
    user_id: uuid.UUID = uuid.UUID(int=0)
    project_id: uuid.UUID = uuid.UUID(int=0)


@dataclass(frozen=True)
class TimerPaused(DomainEvent):
    time_log_id: uuid.UUID = uuid.UUID(int=0)
    user_id: uuid.UUID = uuid.UUID(int=0)
    accumulated_seconds: int = 0


@dataclass(frozen=True)
class TimerResumed(DomainEvent):
    time_log_id: uuid.UUID = uuid.UUID(int=0)
    user_id: uuid.UUID = uuid.UUID(int=0)


@dataclass(frozen=True)
class TimerStopped(DomainEvent):
    time_log_id: uuid.UUID = uuid.UUID(int=0)
    user_id: uuid.UUID = uuid.UUID(int=0)
    project_id: uuid.UUID = uuid.UUID(int=0)
    hours: float = 0.0
    log_date: date = date.min
    description: str = ""
    billable: bool = True
    hourly_rate: float | None = None


@dataclass(frozen=True)
class TimeLogApproved(DomainEvent):
    """Published when a manager approves a time log — triggers AI + Billing."""

    time_log_id: uuid.UUID = uuid.UUID(int=0)
    user_id: uuid.UUID = uuid.UUID(int=0)
    project_id: uuid.UUID = uuid.UUID(int=0)
    hours: float = 0.0
    log_date: date = date.min
    description: str = ""
    billable: bool = True
    hourly_rate: float | None = None


@dataclass(frozen=True)
class TimeLogRejected(DomainEvent):
    time_log_id: uuid.UUID = uuid.UUID(int=0)
    user_id: uuid.UUID = uuid.UUID(int=0)
    reason: str = ""
