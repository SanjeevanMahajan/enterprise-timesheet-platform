from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Header

from src.application.dto.user_dto import (
    AuthRequest,
    CreateUserRequest,
    TokenResponse,
    UserResponse,
)
from src.application.use_cases.users.authenticate_user import AuthenticateUserUseCase
from src.application.use_cases.users.register_user import RegisterUserUseCase
from src.presentation.dependencies import (
    get_authenticate_user_use_case,
    get_register_user_use_case,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    body: CreateUserRequest,
    x_tenant_id: uuid.UUID = Header(...),
    use_case: RegisterUserUseCase = Depends(get_register_user_use_case),
) -> UserResponse:
    return await use_case.execute(x_tenant_id, body)


@router.post("/login", response_model=TokenResponse)
async def login(
    body: AuthRequest,
    x_tenant_id: uuid.UUID = Header(...),
    use_case: AuthenticateUserUseCase = Depends(get_authenticate_user_use_case),
) -> TokenResponse:
    return await use_case.execute(x_tenant_id, body)
