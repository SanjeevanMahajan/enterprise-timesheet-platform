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


class UpdateProjectRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    status: ProjectStatus | None = None
    start_date: date | None = None
    end_date: date | None = None


class ProjectResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    owner_id: uuid.UUID
    status: ProjectStatus
    description: str
    start_date: date | None
    end_date: date | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
