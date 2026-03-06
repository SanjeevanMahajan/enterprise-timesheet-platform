from __future__ import annotations

import uuid

from src.domain.entities.base import Entity


class Organization(Entity):
    def __init__(
        self,
        *,
        tenant_id: uuid.UUID,
        name: str,
        slug: str,
        owner_id: uuid.UUID,
        is_active: bool = True,
        id: uuid.UUID | None = None,
        **kwargs,
    ) -> None:
        super().__init__(id=id, tenant_id=tenant_id, **kwargs)
        self.name = name
        self.slug = slug
        self.owner_id = owner_id
        self.is_active = is_active

    def deactivate(self) -> None:
        self.is_active = False
        self.touch()
