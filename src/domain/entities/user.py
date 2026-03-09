from __future__ import annotations

import uuid

from src.domain.entities.base import Entity
from src.domain.value_objects.enums import Role


class User(Entity):
    def __init__(
        self,
        *,
        tenant_id: uuid.UUID,
        email: str,
        full_name: str,
        hashed_password: str,
        role: Role = Role.MEMBER,
        is_active: bool = True,
        client_id: uuid.UUID | None = None,
        id: uuid.UUID | None = None,
        **kwargs,
    ) -> None:
        super().__init__(id=id, tenant_id=tenant_id, **kwargs)
        self.email = email
        self.full_name = full_name
        self.hashed_password = hashed_password
        self.role = role
        self.is_active = is_active
        self.client_id = client_id

    def deactivate(self) -> None:
        self.is_active = False
        self.touch()

    def change_role(self, new_role: Role) -> None:
        self.role = new_role
        self.touch()

    def has_permission(self, required_role: Role) -> bool:
        hierarchy = {Role.ADMIN: 4, Role.MANAGER: 3, Role.MEMBER: 2, Role.VIEWER: 1, Role.CLIENT: 0}
        return hierarchy.get(self.role, 0) >= hierarchy.get(required_role, 0)
