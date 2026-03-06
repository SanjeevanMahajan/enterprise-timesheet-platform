from __future__ import annotations

import uuid

from src.application.dto.client_dto import ClientResponse
from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.exceptions import EntityNotFoundError


class GetClientUseCase:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def execute(
        self,
        tenant_id: uuid.UUID,
        client_id: uuid.UUID,
    ) -> ClientResponse:
        async with self._uow:
            client = await self._uow.clients.get_by_id(tenant_id, client_id)
            if client is None:
                raise EntityNotFoundError("Client", client_id)

        return ClientResponse(
            id=client.id,
            tenant_id=client.tenant_id,
            name=client.name,
            contact_email=client.contact_email,
            contact_name=client.contact_name,
            is_active=client.is_active,
            created_at=client.created_at,
            updated_at=client.updated_at,
        )
