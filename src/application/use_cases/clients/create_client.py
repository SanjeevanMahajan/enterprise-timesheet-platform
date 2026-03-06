from __future__ import annotations

import uuid

from src.application.dto.client_dto import ClientResponse, CreateClientRequest
from src.application.interfaces.event_publisher import EventPublisher
from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.client import Client
from src.domain.events.client_events import ClientCreated


class CreateClientUseCase:
    def __init__(self, uow: UnitOfWork, events: EventPublisher) -> None:
        self._uow = uow
        self._events = events

    async def execute(
        self,
        tenant_id: uuid.UUID,
        request: CreateClientRequest,
    ) -> ClientResponse:
        client = Client(
            tenant_id=tenant_id,
            name=request.name,
            contact_email=request.contact_email,
            contact_name=request.contact_name,
        )

        async with self._uow:
            client = await self._uow.clients.add(client)
            await self._uow.commit()

        await self._events.publish(
            ClientCreated(
                tenant_id=tenant_id,
                client_id=client.id,
                name=client.name,
            )
        )

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
