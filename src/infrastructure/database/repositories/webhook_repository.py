from __future__ import annotations

import uuid

from sqlalchemy import select

from src.domain.entities.webhook import Webhook
from src.domain.repositories.webhook_repository import WebhookRepository
from src.infrastructure.database.models.webhook_model import WebhookModel
from src.infrastructure.database.repositories.base import SQLAlchemyRepository


class SQLAlchemyWebhookRepository(
    SQLAlchemyRepository[Webhook, WebhookModel], WebhookRepository
):
    model_class = WebhookModel

    def _to_entity(self, model: WebhookModel) -> Webhook:
        return Webhook(
            id=model.id,
            tenant_id=model.tenant_id,
            url=model.url,
            events=list(model.events),
            secret=model.secret,
            is_active=model.is_active,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    def _to_model(self, entity: Webhook) -> WebhookModel:
        return WebhookModel(
            id=entity.id,
            tenant_id=entity.tenant_id,
            url=entity.url,
            events=entity.events,
            secret=entity.secret,
            is_active=entity.is_active,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )

    async def list_active_by_event(
        self,
        tenant_id: uuid.UUID,
        event_type: str,
    ) -> list[Webhook]:
        stmt = (
            select(WebhookModel)
            .where(
                WebhookModel.tenant_id == tenant_id,
                WebhookModel.is_active.is_(True),
                WebhookModel.events.any(event_type),
            )
            .order_by(WebhookModel.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return [self._to_entity(m) for m in result.scalars().all()]
