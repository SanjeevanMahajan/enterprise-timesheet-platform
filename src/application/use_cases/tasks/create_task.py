from __future__ import annotations

import uuid

from src.application.dto.task_dto import CreateTaskRequest, TaskResponse
from src.application.interfaces.event_publisher import EventPublisher
from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.task import Task
from src.domain.events.task_events import TaskAssigned
from src.domain.exceptions import EntityNotFoundError


class CreateTaskUseCase:
    def __init__(self, uow: UnitOfWork, events: EventPublisher) -> None:
        self._uow = uow
        self._events = events

    async def execute(
        self,
        tenant_id: uuid.UUID,
        request: CreateTaskRequest,
    ) -> TaskResponse:
        async with self._uow:
            project = await self._uow.projects.get_by_id(tenant_id, request.project_id)
            if project is None:
                raise EntityNotFoundError("Project", request.project_id)

            task = Task(
                tenant_id=tenant_id,
                project_id=request.project_id,
                title=request.title,
                description=request.description,
                priority=request.priority,
                assignee_id=request.assignee_id,
                phase_id=request.phase_id,
                due_date=request.due_date,
                estimated_hours=request.estimated_hours,
            )

            task = await self._uow.tasks.add(task)
            await self._uow.commit()

        if task.assignee_id is not None:
            await self._events.publish(
                TaskAssigned(
                    tenant_id=tenant_id,
                    task_id=task.id,
                    assignee_id=task.assignee_id,
                    project_id=task.project_id,
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
