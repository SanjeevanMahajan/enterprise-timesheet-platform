from __future__ import annotations

import uuid

from src.application.dto.task_dto import TaskResponse, UpdateTaskRequest
from src.application.interfaces.event_publisher import EventPublisher
from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.events.task_events import TaskStatusChanged
from src.domain.exceptions import EntityNotFoundError


class UpdateTaskUseCase:
    def __init__(self, uow: UnitOfWork, events: EventPublisher) -> None:
        self._uow = uow
        self._events = events

    async def execute(
        self,
        tenant_id: uuid.UUID,
        task_id: uuid.UUID,
        request: UpdateTaskRequest,
    ) -> TaskResponse:
        async with self._uow:
            task = await self._uow.tasks.get_by_id(tenant_id, task_id)
            if task is None:
                raise EntityNotFoundError("Task", task_id)

            old_status = task.status

            if request.title is not None:
                task.title = request.title
            if request.description is not None:
                task.description = request.description
            if request.priority is not None:
                task.priority = request.priority
            if request.due_date is not None:
                task.due_date = request.due_date
            if request.estimated_hours is not None:
                task.estimated_hours = request.estimated_hours
            if request.status is not None and request.status != old_status:
                task.transition_to(request.status)

            task.touch()
            task = await self._uow.tasks.update(task)
            await self._uow.commit()

        if request.status is not None and request.status != old_status:
            await self._events.publish(
                TaskStatusChanged(
                    tenant_id=tenant_id,
                    task_id=task.id,
                    old_status=old_status,
                    new_status=task.status,
                )
            )

        return TaskResponse(
            id=task.id,
            tenant_id=task.tenant_id,
            project_id=task.project_id,
            title=task.title,
            description=task.description,
            status=task.status,
            priority=task.priority,
            assignee_id=task.assignee_id,
            phase_id=task.phase_id,
            due_date=task.due_date,
            estimated_hours=task.estimated_hours,
            created_at=task.created_at,
            updated_at=task.updated_at,
        )
