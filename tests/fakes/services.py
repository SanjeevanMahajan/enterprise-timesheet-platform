from __future__ import annotations

import uuid

from src.application.interfaces.event_publisher import EventPublisher
from src.application.use_cases.users.authenticate_user import TokenService
from src.application.use_cases.users.register_user import PasswordHasher
from src.domain.events.base import DomainEvent


class FakePasswordHasher(PasswordHasher):
    """Deterministic hasher: hash("x") -> "hashed_x", verify("x", "hashed_x") -> True."""

    def hash(self, password: str) -> str:
        return f"hashed_{password}"

    def verify(self, password: str, hashed: str) -> bool:
        return hashed == f"hashed_{password}"


class FakeTokenService(TokenService):
    """Returns predictable tokens for test assertions."""

    def create_access_token(self, user_id: uuid.UUID, tenant_id: uuid.UUID, role: str) -> str:
        return f"access_{user_id}_{role}"

    def create_refresh_token(self, user_id: uuid.UUID, tenant_id: uuid.UUID) -> str:
        return f"refresh_{user_id}"


class FakeEventPublisher(EventPublisher):
    """Captures published events for test assertions."""

    def __init__(self) -> None:
        self.events: list[DomainEvent] = []

    async def publish(self, event: DomainEvent) -> None:
        self.events.append(event)
