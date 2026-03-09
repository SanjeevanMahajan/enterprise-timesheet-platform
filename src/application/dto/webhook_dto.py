from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class CreateWebhookRequest(BaseModel):
    url: str
    events: list[str]
    secret: str


class WebhookResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    url: str
    events: list[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
