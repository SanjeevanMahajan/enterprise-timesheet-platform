from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from src.domain.value_objects.enums import Role


class CreateUserRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: Role = Role.MEMBER
    client_id: uuid.UUID | None = None


class UpdateUserRequest(BaseModel):
    full_name: str | None = None
    role: Role | None = None
    is_active: bool | None = None
    client_id: uuid.UUID | None = None


class UserResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    full_name: str
    role: Role
    is_active: bool
    client_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AuthRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str = "member"
    client_id: uuid.UUID | None = None
