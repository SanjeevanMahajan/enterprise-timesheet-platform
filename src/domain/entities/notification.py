from __future__ import annotations

import uuid

from src.domain.entities.base import Entity
from src.domain.value_objects.enums import NotificationChannel


class Notification(Entity):
    def __init__(
        self,
        *,
        tenant_id: uuid.UUID,
        recipient_id: uuid.UUID,
        channel: NotificationChannel,
        title: str,
        body: str,
        is_read: bool = False,
        id: uuid.UUID | None = None,
        **kwargs,
    ) -> None:
        super().__init__(id=id, tenant_id=tenant_id, **kwargs)
        self.recipient_id = recipient_id
        self.channel = channel
        self.title = title
        self.body = body
        self.is_read = is_read

    def mark_read(self) -> None:
        self.is_read = True
        self.touch()
