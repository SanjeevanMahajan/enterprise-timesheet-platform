from __future__ import annotations

import uuid
from datetime import date

from src.domain.entities.base import Entity


class Phase(Entity):
    def __init__(
        self,
        *,
        tenant_id: uuid.UUID,
        project_id: uuid.UUID,
        name: str,
        sort_order: int = 0,
        start_date: date | None = None,
        end_date: date | None = None,
        id: uuid.UUID | None = None,
        **kwargs,
    ) -> None:
        super().__init__(id=id, tenant_id=tenant_id, **kwargs)
        self.project_id = project_id
        self.name = name
        self.sort_order = sort_order
        self.start_date = start_date
        self.end_date = end_date
