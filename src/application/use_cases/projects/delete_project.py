from __future__ import annotations

import uuid

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.exceptions import EntityNotFoundError
from src.infrastructure.cache.redis_cache import RedisCache


class DeleteProjectUseCase:
    def __init__(self, uow: UnitOfWork, cache: RedisCache | None = None) -> None:
        self._uow = uow
        self._cache = cache

    async def execute(self, tenant_id: uuid.UUID, project_id: uuid.UUID) -> None:
        async with self._uow:
            project = await self._uow.projects.get_by_id(tenant_id, project_id)
            if project is None:
                raise EntityNotFoundError("Project", project_id)
            await self._uow.projects.delete(tenant_id, project_id)
            await self._uow.commit()

        # Invalidate project list cache for this tenant
        if self._cache is not None:
            await self._cache.cache_invalidate_pattern(f"projects:{tenant_id}:*")
