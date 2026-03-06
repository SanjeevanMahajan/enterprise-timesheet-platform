from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class CreateClientRequest(BaseModel):
    name: str
    contact_email: str = ""
    contact_name: str = ""


class UpdateClientRequest(BaseModel):
    name: str | None = None
    contact_email: str | None = None
    contact_name: str | None = None


class ClientResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    contact_email: str
    contact_name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
