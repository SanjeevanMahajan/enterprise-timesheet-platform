from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel

from src.domain.value_objects.enums import TimesheetStatus


class CreateTimesheetRequest(BaseModel):
    week_start: date
    week_end: date


class RejectTimesheetRequest(BaseModel):
    reason: str


class TimesheetResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    week_start: date
    week_end: date
    total_hours: float
    status: TimesheetStatus
    approved_by: uuid.UUID | None
    rejection_reason: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
