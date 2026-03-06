from __future__ import annotations

from abc import ABC, abstractmethod

from src.domain.events.base import DomainEvent


class EventPublisher(ABC):
    """Publishes domain events to the event bus (Pub/Sub)."""

    @abstractmethod
    async def publish(self, event: DomainEvent) -> None: ...

    async def publish_many(self, events: list[DomainEvent]) -> None:
        for event in events:
            await self.publish(event)
