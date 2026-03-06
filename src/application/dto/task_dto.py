from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel

from src.domain.value_objects.enums import TaskPriority, TaskStatus


class CreateTaskRequest(BaseModel):
    project_id: uuid.UUID
    title: str
    description: str = ""
    priority: TaskPriority = TaskPriority.MEDIUM
    assignee_id: uuid.UUID | None = None
    phase_id: uuid.UUID | None = None
    due_date: date | None = None
    estimated_hours: float = 0.0


class UpdateTaskRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: TaskPriority | None = None
    status: TaskStatus | None = None
    due_date: date | None = None
    estimated_hours: float | None = None


class AssignTaskRequest(BaseModel):
    assignee_id: uuid.UUID


class TaskResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: str
    status: TaskStatus
    priority: TaskPriority
    assignee_id: uuid.UUID | None
    phase_id: uuid.UUID | None
    due_date: date | None
    estimated_hours: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
