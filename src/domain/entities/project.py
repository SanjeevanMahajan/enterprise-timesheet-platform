from __future__ import annotations

import uuid
from datetime import date

from src.domain.entities.base import Entity
from src.domain.exceptions import InvalidStateTransitionError
from src.domain.value_objects.enums import ProjectStatus

_VALID_TRANSITIONS: dict[ProjectStatus, set[ProjectStatus]] = {
    ProjectStatus.ACTIVE: {ProjectStatus.ON_HOLD, ProjectStatus.COMPLETED, ProjectStatus.ARCHIVED},
    ProjectStatus.ON_HOLD: {ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED},
    ProjectStatus.COMPLETED: {ProjectStatus.ARCHIVED},
    ProjectStatus.ARCHIVED: set(),
}


class Project(Entity):
    def __init__(
        self,
        *,
        tenant_id: uuid.UUID,
        name: str,
        owner_id: uuid.UUID,
        status: ProjectStatus = ProjectStatus.ACTIVE,
        description: str = "",
        start_date: date | None = None,
        end_date: date | None = None,
        id: uuid.UUID | None = None,
        **kwargs,
    ) -> None:
        super().__init__(id=id, tenant_id=tenant_id, **kwargs)
        self.name = name
        self.owner_id = owner_id
        self.status = status
        self.description = description
        self.start_date = start_date
        self.end_date = end_date

    def transition_to(self, new_status: ProjectStatus) -> None:
        allowed = _VALID_TRANSITIONS.get(self.status, set())
        if new_status not in allowed:
            raise InvalidStateTransitionError("Project", self.status, new_status)
        self.status = new_status
        self.touch()
