from __future__ import annotations

import uuid
from dataclasses import dataclass

from src.domain.events.base import DomainEvent


@dataclass(frozen=True)
class TaskAssigned(DomainEvent):
    task_id: uuid.UUID = uuid.UUID(int=0)
    assignee_id: uuid.UUID = uuid.UUID(int=0)
    project_id: uuid.UUID = uuid.UUID(int=0)


@dataclass(frozen=True)
class TaskStatusChanged(DomainEvent):
    task_id: uuid.UUID = uuid.UUID(int=0)
    old_status: str = ""
    new_status: str = ""
