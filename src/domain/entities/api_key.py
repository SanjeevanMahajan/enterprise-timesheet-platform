from __future__ import annotations

import uuid
from datetime import datetime

from src.domain.entities.base import Entity


class ApiKey(Entity):
    def __init__(
        self,
        *,
        tenant_id: uuid.UUID,
        key_hash: str,
        name: str,
        scopes: list[str],
        is_active: bool = True,
        last_used_at: datetime | None = None,
        id: uuid.UUID | None = None,
        **kwargs,
    ) -> None:
        super().__init__(id=id, tenant_id=tenant_id, **kwargs)
        self.key_hash = key_hash
        self.name = name
        self.scopes = scopes
        self.is_active = is_active
        self.last_used_at = last_used_at

    def deactivate(self) -> None:
        self.is_active = False
        self.touch()

    def record_usage(self) -> None:
        self.last_used_at = datetime.utcnow()
        self.touch()
