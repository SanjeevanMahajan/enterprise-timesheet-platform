"""SSO / OpenID Connect authentication router.

Provides login initiation and callback endpoints that integrate with an external
OIDC identity provider.  On successful authentication the callback creates or
finds the local user and issues a JWT token pair.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Header, HTTPException, Query, status
from fastapi.responses import RedirectResponse

from src.application.dto.user_dto import TokenResponse
from src.domain.entities.user import User
from src.domain.value_objects.enums import Role
from src.infrastructure.config.settings import settings
from src.infrastructure.database.session import async_session_factory
from src.infrastructure.database.unit_of_work import SQLAlchemyUnitOfWork
from src.infrastructure.security.jwt_handler import JWTTokenService
from src.infrastructure.security.oidc import (
    build_authorization_url,
    exchange_code_for_tokens,
    get_userinfo,
)

router = APIRouter(prefix="/auth/sso", tags=["SSO"])

_token_service = JWTTokenService()


@router.get("/login")
async def sso_login(
    x_tenant_id: uuid.UUID = Header(...),
    redirect_uri: str = Query(..., description="Callback URL registered with the OIDC provider"),
) -> RedirectResponse:
    """Redirect the user to the OIDC provider's authorization endpoint."""
    if not settings.oidc_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SSO is not enabled",
        )

    # Use tenant_id as the state parameter for simplicity; in production,
    # use a CSRF-safe random value stored in a session/cookie.
    state = str(x_tenant_id)
    authorization_url = await build_authorization_url(redirect_uri, state)
    return RedirectResponse(url=authorization_url)


@router.get("/callback", response_model=TokenResponse)
async def sso_callback(
    code: str = Query(..., description="Authorization code from the OIDC provider"),
    state: str = Query(..., description="State parameter (tenant_id)"),
    redirect_uri: str = Query(..., description="Same redirect_uri used in /login"),
) -> TokenResponse:
    """Handle the OIDC callback: exchange code, find/create user, issue JWT."""
    if not settings.oidc_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SSO is not enabled",
        )

    try:
        tenant_id = uuid.UUID(state)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid state parameter",
        ) from exc

    # Exchange the authorization code for tokens
    try:
        token_data = await exchange_code_for_tokens(code, redirect_uri)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to exchange code with OIDC provider",
        ) from exc

    # Fetch user info from the OIDC provider
    try:
        oidc_access_token = token_data.get("access_token", "")
        userinfo = await get_userinfo(oidc_access_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch user info from OIDC provider",
        ) from exc

    email = userinfo.get("email", "")
    full_name = userinfo.get("name", email)

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OIDC provider did not return an email address",
        )

    # Find or create the user in the local database
    uow = SQLAlchemyUnitOfWork(async_session_factory)
    async with uow:
        existing_user = await uow.users.get_by_email(tenant_id, email)

        if existing_user is not None:
            user = existing_user
        else:
            user = User(
                tenant_id=tenant_id,
                email=email,
                full_name=full_name,
                hashed_password="",  # SSO users don't have a local password
                role=Role.MEMBER,
            )
            user = await uow.users.add(user)
            await uow.commit()

    # Issue our own JWT tokens
    access_token = _token_service.create_access_token(
        user_id=user.id,
        tenant_id=user.tenant_id,
        role=user.role.value,
    )
    refresh_token = _token_service.create_refresh_token(
        user_id=user.id,
        tenant_id=user.tenant_id,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )
