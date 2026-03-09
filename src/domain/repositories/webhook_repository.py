from __future__ import annotations

import uuid
from abc import abstractmethod

from src.domain.entities.webhook import Webhook
from src.domain.repositories.base import Repository


class WebhookRepository(Repository[Webhook]):
    @abstractmethod
    async def list_active_by_event(
        self,
        tenant_id: uuid.UUID,
        event_type: str,
    ) -> list[Webhook]:
        """Return all active webhooks for a tenant that subscribe to the given event type."""
        ...
