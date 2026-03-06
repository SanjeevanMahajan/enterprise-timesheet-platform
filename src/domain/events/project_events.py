from __future__ import annotations

import uuid
from dataclasses import dataclass

from src.domain.events.base import DomainEvent


@dataclass(frozen=True)
class ProjectCreated(DomainEvent):
    project_id: uuid.UUID = uuid.UUID(int=0)
    name: str = ""
    owner_id: uuid.UUID = uuid.UUID(int=0)


@dataclass(frozen=True)
class ProjectStatusChanged(DomainEvent):
    project_id: uuid.UUID = uuid.UUID(int=0)
    old_status: str = ""
    new_status: str = ""
