from __future__ import annotations

import uuid

from src.application.dto.project_dto import ProjectResponse
from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.exceptions import EntityNotFoundError


class GetProjectUseCase:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def execute(
        self,
        tenant_id: uuid.UUID,
        project_id: uuid.UUID,
    ) -> ProjectResponse:
        async with self._uow:
            project = await self._uow.projects.get_by_id(tenant_id, project_id)
            if project is None:
                raise EntityNotFoundError("Project", project_id)

        return ProjectResponse(
            id=project.id,
            tenant_id=project.tenant_id,
            name=project.name,
            owner_id=project.owner_id,
            status=project.status,
            description=project.description,
            start_date=project.start_date,
            end_date=project.end_date,
            client_id=project.client_id,
            is_billable=project.is_billable,
            default_hourly_rate=project.default_hourly_rate,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )
