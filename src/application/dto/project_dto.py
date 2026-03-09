from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel

from src.domain.value_objects.enums import ProjectStatus


class CreateProjectRequest(BaseModel):
    name: str
    description: str = ""
    start_date: date | None = None
    end_date: date | None = None
    client_id: uuid.UUID | None = None
    is_billable: bool = True
    default_hourly_rate: float | None = None
    estimated_hours: float | None = None
    currency: str = "USD"
    exchange_rate: float = 1.0


class UpdateProjectRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    status: ProjectStatus | None = None
    start_date: date | None = None
    end_date: date | None = None
    client_id: uuid.UUID | None = None
    is_billable: bool | None = None
    default_hourly_rate: float | None = None
    estimated_hours: float | None = None
    currency: str | None = None
    exchange_rate: float | None = None


class ProjectResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    owner_id: uuid.UUID
    status: ProjectStatus
    description: str
    start_date: date | None
    end_date: date | None
    client_id: uuid.UUID | None
    is_billable: bool
    default_hourly_rate: float | None
    estimated_hours: float | None
    currency: str
    exchange_rate: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
