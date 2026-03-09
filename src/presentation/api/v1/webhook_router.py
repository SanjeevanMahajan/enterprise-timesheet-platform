from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from src.application.dto.webhook_dto import CreateWebhookRequest, WebhookResponse
from src.domain.entities.webhook import Webhook
from src.domain.exceptions import EntityNotFoundError
from src.domain.value_objects.enums import Role
from src.infrastructure.security.auth import CurrentUser, get_current_user, require_role
from src.presentation.dependencies import get_webhook_uow

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post("", response_model=WebhookResponse, status_code=201)
async def create_webhook(
    body: CreateWebhookRequest,
    current_user: CurrentUser = Depends(require_role(Role.ADMIN, Role.MANAGER)),
    uow=Depends(get_webhook_uow),
) -> WebhookResponse:
    async with uow:
        webhook = Webhook(
            tenant_id=current_user.tenant_id,
            url=body.url,
            events=body.events,
            secret=body.secret,
        )
        webhook = await uow.webhooks.add(webhook)
        await uow.commit()

    return WebhookResponse(
        id=webhook.id,
        tenant_id=webhook.tenant_id,
        url=webhook.url,
        events=webhook.events,
        is_active=webhook.is_active,
        created_at=webhook.created_at,
        updated_at=webhook.updated_at,
    )


@router.get("", response_model=list[WebhookResponse])
async def list_webhooks(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: CurrentUser = Depends(require_role(Role.ADMIN, Role.MANAGER)),
    uow=Depends(get_webhook_uow),
) -> list[WebhookResponse]:
    async with uow:
        webhooks = await uow.webhooks.list(
            current_user.tenant_id, offset=offset, limit=limit
        )

    return [
        WebhookResponse(
            id=w.id,
            tenant_id=w.tenant_id,
            url=w.url,
            events=w.events,
            is_active=w.is_active,
            created_at=w.created_at,
            updated_at=w.updated_at,
        )
        for w in webhooks
    ]


@router.delete("/{webhook_id}", status_code=204)
async def delete_webhook(
    webhook_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(Role.ADMIN)),
    uow=Depends(get_webhook_uow),
) -> None:
    async with uow:
        webhook = await uow.webhooks.get_by_id(current_user.tenant_id, webhook_id)
        if webhook is None:
            raise EntityNotFoundError("Webhook", webhook_id)
        await uow.webhooks.delete(current_user.tenant_id, webhook_id)
        await uow.commit()
