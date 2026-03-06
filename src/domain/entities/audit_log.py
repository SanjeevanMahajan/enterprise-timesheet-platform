from __future__ import annotations

import uuid
from typing import Any

from src.domain.entities.base import Entity


class AuditLog(Entity):
    def __init__(
        self,
        *,
        tenant_id: uuid.UUID,
        actor_id: uuid.UUID,
        action: str,
        resource_type: str,
        resource_id: uuid.UUID,
        details: dict[str, Any] | None = None,
        id: uuid.UUID | None = None,
        **kwargs,
    ) -> None:
        super().__init__(id=id, tenant_id=tenant_id, **kwargs)
        self.actor_id = actor_id
        self.action = action
        self.resource_type = resource_type
        self.resource_id = resource_id
        self.details = details or {}
