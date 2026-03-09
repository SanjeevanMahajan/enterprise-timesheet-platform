from __future__ import annotations

import uuid

from src.application.dto.project_dto import ProjectResponse
from src.application.interfaces.unit_of_work import UnitOfWork


class ListProjectsUseCase:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def execute(
        self,
        tenant_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 50,
        client_id: uuid.UUID | None = None,
    ) -> list[ProjectResponse]:
        async with self._uow:
            if client_id is not None:
                projects = await self._uow.projects.list_by_client(
                    tenant_id, client_id, offset=offset, limit=limit
                )
            else:
                projects = await self._uow.projects.list(
                    tenant_id, offset=offset, limit=limit
                )

        return [
            ProjectResponse(
                id=p.id,
                tenant_id=p.tenant_id,
                name=p.name,
                owner_id=p.owner_id,
                status=p.status,
                description=p.description,
                start_date=p.start_date,
                end_date=p.end_date,
                client_id=p.client_id,
                is_billable=p.is_billable,
                default_hourly_rate=p.default_hourly_rate,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
            for p in projects
        ]
