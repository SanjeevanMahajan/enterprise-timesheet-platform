from __future__ import annotations

import uuid


class DomainError(Exception):
    """Base class for all domain errors."""


class EntityNotFoundError(DomainError):
    def __init__(self, entity_type: str, entity_id: uuid.UUID) -> None:
        self.entity_type = entity_type
        self.entity_id = entity_id
        super().__init__(f"{entity_type} with id {entity_id} not found")


class TenantMismatchError(DomainError):
    def __init__(self) -> None:
        super().__init__("Tenant mismatch: operation crosses tenant boundary")


class InvalidStateTransitionError(DomainError):
    def __init__(self, entity_type: str, current: str, target: str) -> None:
        super().__init__(
            f"Cannot transition {entity_type} from '{current}' to '{target}'"
        )


class AuthorizationError(DomainError):
    def __init__(self, action: str, resource: str) -> None:
        super().__init__(f"Not authorized to {action} on {resource}")


class DuplicateEntityError(DomainError):
    def __init__(self, entity_type: str, field: str, value: str) -> None:
        super().__init__(f"{entity_type} with {field}='{value}' already exists")


class BusinessRuleViolationError(DomainError):
    def __init__(self, rule: str) -> None:
        super().__init__(f"Business rule violated: {rule}")
