from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class CreateTimeLogRequest(BaseModel):
    project_id: uuid.UUID
    hours: float = Field(gt=0, le=24)
    log_date: date
    task_id: uuid.UUID | None = None
    description: str = ""
    billable: bool = True
    hourly_rate: float | None = None


class UpdateTimeLogRequest(BaseModel):
    hours: float | None = Field(default=None, gt=0, le=24)
    description: str | None = None
    billable: bool | None = None
    hourly_rate: float | None = None


class StartTimerRequest(BaseModel):
    project_id: uuid.UUID
    log_date: date
    task_id: uuid.UUID | None = None
    description: str = ""
    billable: bool = True
    hourly_rate: float | None = None


class RejectRequest(BaseModel):
    reason: str = ""


class TimeLogResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    project_id: uuid.UUID
    task_id: uuid.UUID | None
    hours: float
    log_date: date
    description: str
    billable: bool
    hourly_rate: float | None
    billable_amount: float
    timer_started_at: datetime | None
    timer_stopped_at: datetime | None
    is_timer_running: bool
    timer_status: str = "idle"
    accumulated_seconds: int = 0
    is_timer_paused: bool = False
    approval_status: str = "draft"
    ai_category: str | None = None
    ai_quality_score: int | None = None
    ai_suggestion: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
