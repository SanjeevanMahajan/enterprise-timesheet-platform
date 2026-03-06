from __future__ import annotations

import uuid

from src.application.dto.timelog_dto import TimeLogResponse, UpdateTimeLogRequest
from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.exceptions import EntityNotFoundError


class UpdateTimeLogUseCase:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def execute(
        self,
        tenant_id: uuid.UUID,
        time_log_id: uuid.UUID,
        request: UpdateTimeLogRequest,
    ) -> TimeLogResponse:
        async with self._uow:
            time_log = await self._uow.time_logs.get_by_id(tenant_id, time_log_id)
            if time_log is None:
                raise EntityNotFoundError("TimeLog", time_log_id)

            if request.hours is not None:
                time_log.update_hours(request.hours)
            if request.description is not None:
                time_log.description = request.description
            if request.billable is not None:
                time_log.billable = request.billable
            if request.hourly_rate is not None:
                time_log.hourly_rate = request.hourly_rate

            time_log.touch()
            time_log = await self._uow.time_logs.update(time_log)
            await self._uow.commit()

        return TimeLogResponse(
            id=time_log.id,
            tenant_id=time_log.tenant_id,
            user_id=time_log.user_id,
            project_id=time_log.project_id,
            task_id=time_log.task_id,
            hours=time_log.hours,
            log_date=time_log.log_date,
            description=time_log.description,
            billable=time_log.billable,
            hourly_rate=time_log.hourly_rate,
            billable_amount=time_log.billable_amount,
            timer_started_at=time_log.timer_started_at,
            timer_stopped_at=time_log.timer_stopped_at,
            is_timer_running=time_log.is_timer_running,
            ai_category=time_log.ai_category,
            ai_quality_score=time_log.ai_quality_score,
            ai_suggestion=time_log.ai_suggestion,
            created_at=time_log.created_at,
            updated_at=time_log.updated_at,
        )
