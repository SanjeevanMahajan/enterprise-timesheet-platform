from __future__ import annotations

import uuid

from sqlalchemy import select

from src.domain.entities.project import Project
from src.domain.repositories.project_repository import ProjectRepository
from src.domain.value_objects.enums import ProjectStatus
from src.infrastructure.database.models.project_model import ProjectModel
from src.infrastructure.database.repositories.base import SQLAlchemyRepository


class SQLAlchemyProjectRepository(
    SQLAlchemyRepository[Project, ProjectModel], ProjectRepository
):
    model_class = ProjectModel

    def _to_entity(self, model: ProjectModel) -> Project:
        return Project(
            id=model.id,
            tenant_id=model.tenant_id,
            name=model.name,
            owner_id=model.owner_id,
            status=ProjectStatus(model.status),
            description=model.description,
            start_date=model.start_date,
            end_date=model.end_date,
            client_id=model.client_id,
            is_billable=model.is_billable,
            default_hourly_rate=model.default_hourly_rate,
            estimated_hours=model.estimated_hours,
            currency=model.currency,
            exchange_rate=model.exchange_rate,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    def _to_model(self, entity: Project) -> ProjectModel:
        return ProjectModel(
            id=entity.id,
            tenant_id=entity.tenant_id,
            name=entity.name,
            owner_id=entity.owner_id,
            status=entity.status.value,
            description=entity.description,
            start_date=entity.start_date,
            end_date=entity.end_date,
            client_id=entity.client_id,
            is_billable=entity.is_billable,
            default_hourly_rate=entity.default_hourly_rate,
            estimated_hours=entity.estimated_hours,
            currency=entity.currency,
            exchange_rate=entity.exchange_rate,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )

    async def list_by_owner(
        self,
        tenant_id: uuid.UUID,
        owner_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Project]:
        stmt = (
            select(ProjectModel)
            .where(
                ProjectModel.tenant_id == tenant_id,
                ProjectModel.owner_id == owner_id,
            )
            .order_by(ProjectModel.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [self._to_entity(m) for m in result.scalars().all()]

    async def list_by_status(
        self,
        tenant_id: uuid.UUID,
        status: ProjectStatus,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Project]:
        stmt = (
            select(ProjectModel)
            .where(
                ProjectModel.tenant_id == tenant_id,
                ProjectModel.status == status.value,
            )
            .order_by(ProjectModel.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [self._to_entity(m) for m in result.scalars().all()]

    async def list_by_client(
        self,
        tenant_id: uuid.UUID,
        client_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Project]:
        stmt = (
            select(ProjectModel)
            .where(
                ProjectModel.tenant_id == tenant_id,
                ProjectModel.client_id == client_id,
            )
            .order_by(ProjectModel.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [self._to_entity(m) for m in result.scalars().all()]
