from __future__ import annotations

import uuid

from src.application.dto.task_dto import TaskResponse
from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.exceptions import EntityNotFoundError


class GetTaskUseCase:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def execute(
        self,
        tenant_id: uuid.UUID,
        task_id: uuid.UUID,
    ) -> TaskResponse:
        async with self._uow:
            task = await self._uow.tasks.get_by_id(tenant_id, task_id)
            if task is None:
                raise EntityNotFoundError("Task", task_id)

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
