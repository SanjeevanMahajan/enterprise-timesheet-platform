from __future__ import annotations

import uuid
from datetime import datetime


class Entity:
    """Base class for all domain entities.

    Every entity has: id, tenant_id, created_at, updated_at.
    Multi-tenancy is baked into every entity by design.
    """

    def __init__(
        self,
        *,
        id: uuid.UUID | None = None,
        tenant_id: uuid.UUID,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ) -> None:
        self.id = id or uuid.uuid4()
        self.tenant_id = tenant_id
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()

    def touch(self) -> None:
        self.updated_at = datetime.utcnow()

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Entity):
            return NotImplemented
        return self.id == other.id

    def __hash__(self) -> int:
        return hash(self.id)
