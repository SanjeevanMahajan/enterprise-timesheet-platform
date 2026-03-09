"""OpenID Connect (OIDC) helper utilities.

Encapsulates the OIDC discovery, authorization URL construction, and token
exchange flow.  Uses ``httpx`` for async HTTP calls to the OIDC provider.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from src.infrastructure.config.settings import settings

logger = logging.getLogger(__name__)

_TIMEOUT = 10.0


async def get_oidc_discovery() -> dict[str, Any]:
    """Fetch the OpenID Connect discovery document from the issuer."""
    discovery_url = f"{settings.oidc_issuer_url}/.well-known/openid-configuration"
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.get(discovery_url)
        response.raise_for_status()
        return response.json()


async def build_authorization_url(redirect_uri: str, state: str) -> str:
    """Return the full authorization URL for the OIDC provider."""
    discovery = await get_oidc_discovery()
    authorization_endpoint = discovery["authorization_endpoint"]
    params = {
        "client_id": settings.oidc_client_id,
        "response_type": "code",
        "scope": "openid email profile",
        "redirect_uri": redirect_uri,
        "state": state,
    }
    query_string = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{authorization_endpoint}?{query_string}"


async def exchange_code_for_tokens(
    code: str, redirect_uri: str
) -> dict[str, Any]:
    """Exchange an authorization code for tokens at the OIDC provider."""
    discovery = await get_oidc_discovery()
    token_endpoint = discovery["token_endpoint"]

    data = {
        "grant_type": "authorization_code",
        "client_id": settings.oidc_client_id,
        "client_secret": settings.oidc_client_secret,
        "code": code,
        "redirect_uri": redirect_uri,
    }

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.post(token_endpoint, data=data)
        response.raise_for_status()
        return response.json()


async def get_userinfo(access_token: str) -> dict[str, Any]:
    """Fetch user information from the OIDC provider's userinfo endpoint."""
    discovery = await get_oidc_discovery()
    userinfo_endpoint = discovery["userinfo_endpoint"]

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.get(
            userinfo_endpoint,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        response.raise_for_status()
        return response.json()
