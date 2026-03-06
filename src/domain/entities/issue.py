from __future__ import annotations

import uuid

from src.domain.entities.base import Entity
from src.domain.value_objects.enums import IssuePriority, IssueStatus


class Issue(Entity):
    def __init__(
        self,
        *,
        tenant_id: uuid.UUID,
        project_id: uuid.UUID,
        title: str,
        reported_by: uuid.UUID,
        status: IssueStatus = IssueStatus.OPEN,
        priority: IssuePriority = IssuePriority.MEDIUM,
        assignee_id: uuid.UUID | None = None,
        description: str = "",
        id: uuid.UUID | None = None,
        **kwargs,
    ) -> None:
        super().__init__(id=id, tenant_id=tenant_id, **kwargs)
        self.project_id = project_id
        self.title = title
        self.reported_by = reported_by
        self.status = status
        self.priority = priority
        self.assignee_id = assignee_id
        self.description = description
