from __future__ import annotations

import uuid

from src.application.dto.client_dto import ClientResponse
from src.application.interfaces.unit_of_work import UnitOfWork


class ListClientsUseCase:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def execute(
        self,
        tenant_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[ClientResponse]:
        async with self._uow:
            clients = await self._uow.clients.list(
                tenant_id, offset=offset, limit=limit
            )

        return [
            ClientResponse(
                id=c.id,
                tenant_id=c.tenant_id,
                name=c.name,
                contact_email=c.contact_email,
                contact_name=c.contact_name,
                is_active=c.is_active,
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
            for c in clients
        ]
