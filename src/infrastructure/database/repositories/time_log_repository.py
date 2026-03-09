from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import func, select

from src.domain.entities.time_log import TimeLog
from src.domain.repositories.time_log_repository import TimeLogRepository
from src.domain.value_objects.enums import ApprovalStatus, TimerStatus
from src.infrastructure.database.models.time_log_model import TimeLogModel
from src.infrastructure.database.repositories.base import SQLAlchemyRepository


class SQLAlchemyTimeLogRepository(
    SQLAlchemyRepository[TimeLog, TimeLogModel], TimeLogRepository
):
    model_class = TimeLogModel

    def _to_entity(self, model: TimeLogModel) -> TimeLog:
        entity = TimeLog(
            id=model.id,
            tenant_id=model.tenant_id,
            user_id=model.user_id,
            project_id=model.project_id,
            task_id=model.task_id,
            hours=model.hours,
            log_date=model.log_date,
            description=model.description,
            billable=model.billable,
            hourly_rate=model.hourly_rate,
            timer_started_at=model.timer_started_at,
            timer_stopped_at=model.timer_stopped_at,
            timer_status=TimerStatus(model.timer_status),
            accumulated_seconds=model.accumulated_seconds,
            approval_status=ApprovalStatus(model.approval_status),
            timesheet_id=model.timesheet_id,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )
        entity.ai_category = model.ai_category
        entity.ai_quality_score = model.ai_quality_score
        entity.ai_suggestion = model.ai_suggestion
        return entity

    def _to_model(self, entity: TimeLog) -> TimeLogModel:
        return TimeLogModel(
            id=entity.id,
            tenant_id=entity.tenant_id,
            user_id=entity.user_id,
            project_id=entity.project_id,
            task_id=entity.task_id,
            hours=entity.hours,
            log_date=entity.log_date,
            description=entity.description,
            billable=entity.billable,
            hourly_rate=entity.hourly_rate,
            timer_started_at=entity.timer_started_at,
            timer_stopped_at=entity.timer_stopped_at,
            timer_status=entity.timer_status.value,
            accumulated_seconds=entity.accumulated_seconds,
            approval_status=entity.approval_status.value,
            timesheet_id=entity.timesheet_id,
            ai_category=entity.ai_category,
            ai_quality_score=entity.ai_quality_score,
            ai_suggestion=entity.ai_suggestion,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )

    async def list_by_user(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        *,
        start_date: date | None = None,
        end_date: date | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[TimeLog]:
        stmt = select(TimeLogModel).where(
            TimeLogModel.tenant_id == tenant_id,
            TimeLogModel.user_id == user_id,
        )
        if start_date:
            stmt = stmt.where(TimeLogModel.log_date >= start_date)
        if end_date:
            stmt = stmt.where(TimeLogModel.log_date <= end_date)
        stmt = stmt.order_by(TimeLogModel.log_date.desc()).offset(offset).limit(limit)

        result = await self._session.execute(stmt)
        return [self._to_entity(m) for m in result.scalars().all()]

    async def list_by_project(
        self,
        tenant_id: uuid.UUID,
        project_id: uuid.UUID,
        *,
        start_date: date | None = None,
        end_date: date | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[TimeLog]:
        stmt = select(TimeLogModel).where(
            TimeLogModel.tenant_id == tenant_id,
            TimeLogModel.project_id == project_id,
        )
        if start_date:
            stmt = stmt.where(TimeLogModel.log_date >= start_date)
        if end_date:
            stmt = stmt.where(TimeLogModel.log_date <= end_date)
        stmt = stmt.order_by(TimeLogModel.log_date.desc()).offset(offset).limit(limit)

        result = await self._session.execute(stmt)
        return [self._to_entity(m) for m in result.scalars().all()]

    async def sum_hours_for_user_on_date(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        log_date: date,
    ) -> float:
        stmt = select(func.coalesce(func.sum(TimeLogModel.hours), 0.0)).where(
            TimeLogModel.tenant_id == tenant_id,
            TimeLogModel.user_id == user_id,
            TimeLogModel.log_date == log_date,
        )
        result = await self._session.execute(stmt)
        return float(result.scalar() or 0.0)

    async def list_by_approval_status(
        self,
        tenant_id: uuid.UUID,
        status: ApprovalStatus,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[TimeLog]:
        stmt = (
            select(TimeLogModel)
            .where(
                TimeLogModel.tenant_id == tenant_id,
                TimeLogModel.approval_status == status.value,
            )
            .order_by(TimeLogModel.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [self._to_entity(m) for m in result.scalars().all()]

    async def list_by_timesheet(
        self,
        tenant_id: uuid.UUID,
        timesheet_id: uuid.UUID,
    ) -> list[TimeLog]:
        stmt = select(TimeLogModel).where(
            TimeLogModel.tenant_id == tenant_id,
            TimeLogModel.timesheet_id == timesheet_id,
        )
        result = await self._session.execute(stmt)
        return [self._to_entity(m) for m in result.scalars().all()]
