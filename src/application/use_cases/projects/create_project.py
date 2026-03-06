from __future__ import annotations

import uuid

from src.application.dto.project_dto import CreateProjectRequest, ProjectResponse
from src.application.interfaces.event_publisher import EventPublisher
from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.project import Project
from src.domain.events.project_events import ProjectCreated
from src.domain.exceptions import EntityNotFoundError


class CreateProjectUseCase:
    def __init__(self, uow: UnitOfWork, events: EventPublisher) -> None:
        self._uow = uow
        self._events = events

    async def execute(
        self,
        tenant_id: uuid.UUID,
        owner_id: uuid.UUID,
        request: CreateProjectRequest,
    ) -> ProjectResponse:
        async with self._uow:
            if request.client_id is not None:
                client = await self._uow.clients.get_by_id(tenant_id, request.client_id)
                if client is None:
                    raise EntityNotFoundError("Client", request.client_id)

            project = Project(
                tenant_id=tenant_id,
                name=request.name,
                owner_id=owner_id,
                description=request.description,
                start_date=request.start_date,
                end_date=request.end_date,
                client_id=request.client_id,
                is_billable=request.is_billable,
                default_hourly_rate=request.default_hourly_rate,
            )

            project = await self._uow.projects.add(project)
            await self._uow.commit()

        await self._events.publish(
            ProjectCreated(
                tenant_id=tenant_id,
                project_id=project.id,
                name=project.name,
                owner_id=owner_id,
            )
        )

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
