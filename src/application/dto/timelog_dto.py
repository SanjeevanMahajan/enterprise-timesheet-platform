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


class UpdateTimeLogRequest(BaseModel):
    hours: float | None = Field(default=None, gt=0, le=24)
    description: str | None = None
    billable: bool | None = None


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
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
