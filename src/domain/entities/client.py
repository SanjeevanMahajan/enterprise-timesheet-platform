from __future__ import annotations

import uuid

from src.domain.entities.base import Entity


class Client(Entity):
    def __init__(
        self,
        *,
        tenant_id: uuid.UUID,
        name: str,
        contact_email: str = "",
        contact_name: str = "",
        is_active: bool = True,
        id: uuid.UUID | None = None,
        **kwargs,
    ) -> None:
        super().__init__(id=id, tenant_id=tenant_id, **kwargs)
        self.name = name
        self.contact_email = contact_email
        self.contact_name = contact_name
        self.is_active = is_active

    def deactivate(self) -> None:
        self.is_active = False
        self.touch()
