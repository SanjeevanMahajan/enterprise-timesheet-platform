from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from src.domain.exceptions import (
    AuthorizationError,
    BusinessRuleViolationError,
    DomainError,
    DuplicateEntityError,
    EntityNotFoundError,
    InvalidStateTransitionError,
)


def _error_response(status_code: int, detail: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"detail": detail})


async def entity_not_found_handler(_: Request, exc: EntityNotFoundError) -> JSONResponse:
    return _error_response(404, str(exc))


async def authorization_error_handler(_: Request, exc: AuthorizationError) -> JSONResponse:
    return _error_response(403, str(exc))


async def duplicate_entity_handler(_: Request, exc: DuplicateEntityError) -> JSONResponse:
    return _error_response(409, str(exc))


async def invalid_state_transition_handler(
    _: Request, exc: InvalidStateTransitionError
) -> JSONResponse:
    return _error_response(400, str(exc))


async def business_rule_handler(_: Request, exc: BusinessRuleViolationError) -> JSONResponse:
    return _error_response(400, str(exc))


async def domain_error_handler(_: Request, exc: DomainError) -> JSONResponse:
    return _error_response(400, str(exc))


def register_exception_handlers(app: FastAPI) -> None:
    """Register all domain-to-HTTP exception mappings on the FastAPI app.

    Order matters: more specific exceptions must be registered before the
    base DomainError catch-all so FastAPI matches them first.
    """
    app.add_exception_handler(EntityNotFoundError, entity_not_found_handler)
    app.add_exception_handler(AuthorizationError, authorization_error_handler)
    app.add_exception_handler(DuplicateEntityError, duplicate_entity_handler)
    app.add_exception_handler(InvalidStateTransitionError, invalid_state_transition_handler)
    app.add_exception_handler(BusinessRuleViolationError, business_rule_handler)
    app.add_exception_handler(DomainError, domain_error_handler)
