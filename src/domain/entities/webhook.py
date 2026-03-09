from __future__ import annotations

import uuid

from src.domain.entities.base import Entity


class Webhook(Entity):
    def __init__(
        self,
        *,
        tenant_id: uuid.UUID,
        url: str,
        events: list[str],
        secret: str,
        is_active: bool = True,
        id: uuid.UUID | None = None,
        **kwargs,
    ) -> None:
        super().__init__(id=id, tenant_id=tenant_id, **kwargs)
        self.url = url
        self.events = events
        self.secret = secret
        self.is_active = is_active

    def deactivate(self) -> None:
        self.is_active = False
        self.touch()

    def activate(self) -> None:
        self.is_active = True
        self.touch()
