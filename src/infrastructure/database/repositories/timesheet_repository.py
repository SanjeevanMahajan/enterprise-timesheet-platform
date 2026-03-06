from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select

from src.domain.entities.timesheet import Timesheet
from src.domain.repositories.timesheet_repository import TimesheetRepository
from src.domain.value_objects.enums import TimesheetStatus
from src.infrastructure.database.models.timesheet_model import TimesheetModel
from src.infrastructure.database.repositories.base import SQLAlchemyRepository


class SQLAlchemyTimesheetRepository(
    SQLAlchemyRepository[Timesheet, TimesheetModel], TimesheetRepository
):
    model_class = TimesheetModel

    def _to_entity(self, model: TimesheetModel) -> Timesheet:
        return Timesheet(
            id=model.id,
            tenant_id=model.tenant_id,
            user_id=model.user_id,
            week_start=model.week_start,
            week_end=model.week_end,
            total_hours=model.total_hours,
            status=TimesheetStatus(model.status),
            approved_by=model.approved_by,
            rejection_reason=model.rejection_reason,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    def _to_model(self, entity: Timesheet) -> TimesheetModel:
        return TimesheetModel(
            id=entity.id,
            tenant_id=entity.tenant_id,
            user_id=entity.user_id,
            week_start=entity.week_start,
            week_end=entity.week_end,
            total_hours=entity.total_hours,
            status=entity.status.value,
            approved_by=entity.approved_by,
            rejection_reason=entity.rejection_reason,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )

    async def get_by_user_and_week(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        week_start: date,
    ) -> Timesheet | None:
        stmt = select(TimesheetModel).where(
            TimesheetModel.tenant_id == tenant_id,
            TimesheetModel.user_id == user_id,
            TimesheetModel.week_start == week_start,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list_by_user(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Timesheet]:
        stmt = (
            select(TimesheetModel)
            .where(
                TimesheetModel.tenant_id == tenant_id,
                TimesheetModel.user_id == user_id,
            )
            .order_by(TimesheetModel.week_start.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [self._to_entity(m) for m in result.scalars().all()]

    async def list_pending_approval(
        self,
        tenant_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Timesheet]:
        stmt = (
            select(TimesheetModel)
            .where(
                TimesheetModel.tenant_id == tenant_id,
                TimesheetModel.status == TimesheetStatus.SUBMITTED.value,
            )
            .order_by(TimesheetModel.created_at.asc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [self._to_entity(m) for m in result.scalars().all()]
