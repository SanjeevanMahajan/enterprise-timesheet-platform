"""Webhook delivery service.

Delivers domain events to registered webhook URLs with HMAC-SHA256 signatures
for payload integrity verification.  Delivery is best-effort: failures are
logged but do not propagate to callers.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import uuid
from datetime import datetime
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = 10.0  # seconds


def _json_default(obj: object) -> str:
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def _sign_payload(payload: str, secret: str) -> str:
    """Compute HMAC-SHA256 hex digest for the given payload and secret."""
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


class WebhookDeliveryService:
    """Posts event payloads to webhook URLs with HMAC-SHA256 signatures."""

    async def deliver(
        self,
        url: str,
        secret: str,
        event_type: str,
        payload: dict[str, Any],
    ) -> bool:
        """Deliver a single webhook.  Returns ``True`` on success."""
        body = json.dumps(
            {"event_type": event_type, "data": payload},
            default=_json_default,
        )
        signature = _sign_payload(body, secret)

        headers = {
            "Content-Type": "application/json",
            "X-Webhook-Signature": f"sha256={signature}",
            "X-Webhook-Event": event_type,
        }

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                response = await client.post(url, content=body, headers=headers)
                if response.is_success:
                    logger.info(
                        "Webhook delivered to %s (event=%s, status=%d)",
                        url,
                        event_type,
                        response.status_code,
                    )
                    return True
                logger.warning(
                    "Webhook delivery failed for %s (event=%s, status=%d)",
                    url,
                    event_type,
                    response.status_code,
                )
                return False
        except Exception:
            logger.exception("Webhook delivery error for %s (event=%s)", url, event_type)
            return False
