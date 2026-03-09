from __future__ import annotations

import uuid

from src.application.dto.project_dto import ProjectResponse
from src.application.interfaces.unit_of_work import UnitOfWork
from src.infrastructure.cache.redis_cache import RedisCache

PROJECTS_CACHE_TTL = 60  # seconds


class ListProjectsUseCase:
    def __init__(self, uow: UnitOfWork, cache: RedisCache | None = None) -> None:
        self._uow = uow
        self._cache = cache

    async def execute(
        self,
        tenant_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 50,
        client_id: uuid.UUID | None = None,
    ) -> list[ProjectResponse]:
        # Build a cache key scoped to the tenant and query parameters
        cache_key = f"projects:{tenant_id}:{offset}:{limit}:{client_id}"

        # Try cache first
        if self._cache is not None:
            cached = await self._cache.cache_get(cache_key)
            if cached is not None:
                return [ProjectResponse(**item) for item in cached]

        async with self._uow:
            if client_id is not None:
                projects = await self._uow.projects.list_by_client(
                    tenant_id, client_id, offset=offset, limit=limit
                )
            else:
                projects = await self._uow.projects.list(
                    tenant_id, offset=offset, limit=limit
                )

        results = [
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
                currency=p.currency,
                exchange_rate=p.exchange_rate,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
            for p in projects
        ]

        # Store in cache
        if self._cache is not None:
            await self._cache.cache_set(
                cache_key,
                [r.model_dump(mode="json") for r in results],
                ttl=PROJECTS_CACHE_TTL,
            )

        return results
