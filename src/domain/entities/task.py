from __future__ import annotations

import uuid
from datetime import date

from src.domain.entities.base import Entity
from src.domain.exceptions import InvalidStateTransitionError
from src.domain.value_objects.enums import TaskPriority, TaskStatus

_VALID_TRANSITIONS: dict[TaskStatus, set[TaskStatus]] = {
    TaskStatus.TODO: {TaskStatus.IN_PROGRESS},
    TaskStatus.IN_PROGRESS: {TaskStatus.REVIEW, TaskStatus.TODO},
    TaskStatus.REVIEW: {TaskStatus.DONE, TaskStatus.IN_PROGRESS},
    TaskStatus.DONE: {TaskStatus.TODO},
}


class Task(Entity):
    def __init__(
        self,
        *,
        tenant_id: uuid.UUID,
        project_id: uuid.UUID,
        title: str,
        status: TaskStatus = TaskStatus.TODO,
        priority: TaskPriority = TaskPriority.MEDIUM,
        assignee_id: uuid.UUID | None = None,
        phase_id: uuid.UUID | None = None,
        description: str = "",
        due_date: date | None = None,
        estimated_hours: float = 0.0,
        id: uuid.UUID | None = None,
        **kwargs,
    ) -> None:
        super().__init__(id=id, tenant_id=tenant_id, **kwargs)
        self.project_id = project_id
        self.title = title
        self.status = status
        self.priority = priority
        self.assignee_id = assignee_id
        self.phase_id = phase_id
        self.description = description
        self.due_date = due_date
        self.estimated_hours = estimated_hours

    def transition_to(self, new_status: TaskStatus) -> None:
        allowed = _VALID_TRANSITIONS.get(self.status, set())
        if new_status not in allowed:
            raise InvalidStateTransitionError("Task", self.status, new_status)
        self.status = new_status
        self.touch()

    def assign_to(self, user_id: uuid.UUID) -> None:
        self.assignee_id = user_id
        self.touch()

    def unassign(self) -> None:
        self.assignee_id = None
        self.touch()
