from __future__ import annotations

import uuid

from sqlalchemy import select

from src.domain.entities.task import Task
from src.domain.repositories.task_repository import TaskRepository
from src.domain.value_objects.enums import TaskPriority, TaskStatus
from src.infrastructure.database.models.task_model import TaskModel
from src.infrastructure.database.repositories.base import SQLAlchemyRepository


class SQLAlchemyTaskRepository(
    SQLAlchemyRepository[Task, TaskModel], TaskRepository
):
    model_class = TaskModel

    def _to_entity(self, model: TaskModel) -> Task:
        return Task(
            id=model.id,
            tenant_id=model.tenant_id,
            project_id=model.project_id,
            title=model.title,
            description=model.description,
            status=TaskStatus(model.status),
            priority=TaskPriority(model.priority),
            assignee_id=model.assignee_id,
            phase_id=model.phase_id,
            due_date=model.due_date,
            estimated_hours=model.estimated_hours,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    def _to_model(self, entity: Task) -> TaskModel:
        return TaskModel(
            id=entity.id,
            tenant_id=entity.tenant_id,
            project_id=entity.project_id,
            title=entity.title,
            description=entity.description,
            status=entity.status.value,
            priority=entity.priority.value,
            assignee_id=entity.assignee_id,
            phase_id=entity.phase_id,
            due_date=entity.due_date,
            estimated_hours=entity.estimated_hours,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )

    async def list_by_project(
        self,
        tenant_id: uuid.UUID,
        project_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Task]:
        stmt = (
            select(TaskModel)
            .where(
                TaskModel.tenant_id == tenant_id,
                TaskModel.project_id == project_id,
            )
            .order_by(TaskModel.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [self._to_entity(m) for m in result.scalars().all()]

    async def list_by_assignee(
        self,
        tenant_id: uuid.UUID,
        assignee_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Task]:
        stmt = (
            select(TaskModel)
            .where(
                TaskModel.tenant_id == tenant_id,
                TaskModel.assignee_id == assignee_id,
            )
            .order_by(TaskModel.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [self._to_entity(m) for m in result.scalars().all()]
