from __future__ import annotations

import uuid
from dataclasses import dataclass

from src.domain.events.base import DomainEvent


@dataclass(frozen=True)
class ClientCreated(DomainEvent):
    client_id: uuid.UUID = uuid.UUID(int=0)
    name: str = ""
