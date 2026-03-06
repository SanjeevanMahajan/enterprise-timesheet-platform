from __future__ import annotations

import uuid

from src.application.dto.task_dto import TaskResponse
from src.application.interfaces.unit_of_work import UnitOfWork


class ListTasksUseCase:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def execute(
        self,
        tenant_id: uuid.UUID,
        *,
        project_id: uuid.UUID | None = None,
        assignee_id: uuid.UUID | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[TaskResponse]:
        async with self._uow:
            if project_id is not None:
                tasks = await self._uow.tasks.list_by_project(
                    tenant_id, project_id, offset=offset, limit=limit
                )
            elif assignee_id is not None:
                tasks = await self._uow.tasks.list_by_assignee(
                    tenant_id, assignee_id, offset=offset, limit=limit
                )
            else:
                tasks = await self._uow.tasks.list(
                    tenant_id, offset=offset, limit=limit
                )

        return [
            TaskResponse(
                id=t.id,
                tenant_id=t.tenant_id,
                project_id=t.project_id,
                title=t.title,
                description=t.description,
                status=t.status,
                priority=t.priority,
                assignee_id=t.assignee_id,
                phase_id=t.phase_id,
                due_date=t.due_date,
                estimated_hours=t.estimated_hours,
                created_at=t.created_at,
                updated_at=t.updated_at,
            )
            for t in tasks
        ]
