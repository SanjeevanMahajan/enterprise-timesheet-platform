from __future__ import annotations

import uuid

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.exceptions import EntityNotFoundError


class DeleteProjectUseCase:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def execute(self, tenant_id: uuid.UUID, project_id: uuid.UUID) -> None:
        async with self._uow:
            project = await self._uow.projects.get_by_id(tenant_id, project_id)
            if project is None:
                raise EntityNotFoundError("Project", project_id)
            await self._uow.projects.delete(tenant_id, project_id)
            await self._uow.commit()
