from __future__ import annotations

import uuid

from src.application.dto.project_dto import ProjectResponse, UpdateProjectRequest
from src.application.interfaces.event_publisher import EventPublisher
from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.events.project_events import ProjectStatusChanged
from src.domain.exceptions import EntityNotFoundError


class UpdateProjectUseCase:
    def __init__(self, uow: UnitOfWork, events: EventPublisher) -> None:
        self._uow = uow
        self._events = events

    async def execute(
        self,
        tenant_id: uuid.UUID,
        project_id: uuid.UUID,
        request: UpdateProjectRequest,
    ) -> ProjectResponse:
        async with self._uow:
            project = await self._uow.projects.get_by_id(tenant_id, project_id)
            if project is None:
                raise EntityNotFoundError("Project", project_id)

            old_status = project.status

            if request.name is not None:
                project.name = request.name
            if request.description is not None:
                project.description = request.description
            if request.start_date is not None:
                project.start_date = request.start_date
            if request.end_date is not None:
                project.end_date = request.end_date
            if request.client_id is not None:
                project.client_id = request.client_id
            if request.is_billable is not None:
                project.is_billable = request.is_billable
            if request.default_hourly_rate is not None:
                project.default_hourly_rate = request.default_hourly_rate
            if request.status is not None and request.status != old_status:
                project.transition_to(request.status)

            project.touch()
            project = await self._uow.projects.update(project)
            await self._uow.commit()

        if request.status is not None and request.status != old_status:
            await self._events.publish(
                ProjectStatusChanged(
                    tenant_id=tenant_id,
                    project_id=project.id,
                    old_status=old_status,
                    new_status=project.status,
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
