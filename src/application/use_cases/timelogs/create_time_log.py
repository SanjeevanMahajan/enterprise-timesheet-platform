from __future__ import annotations

import uuid

from src.application.dto.timelog_dto import CreateTimeLogRequest, TimeLogResponse
from src.application.interfaces.event_publisher import EventPublisher
from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.time_log import TimeLog
from src.domain.events.timelog_events import TimeLogCreated
from src.domain.exceptions import BusinessRuleViolationError, EntityNotFoundError


class CreateTimeLogUseCase:
    def __init__(self, uow: UnitOfWork, events: EventPublisher) -> None:
        self._uow = uow
        self._events = events

    async def execute(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        request: CreateTimeLogRequest,
    ) -> TimeLogResponse:
        async with self._uow:
            project = await self._uow.projects.get_by_id(tenant_id, request.project_id)
            if project is None:
                raise EntityNotFoundError("Project", request.project_id)

            existing_hours = await self._uow.time_logs.sum_hours_for_user_on_date(
                tenant_id, user_id, request.log_date
            )
            if existing_hours + request.hours > TimeLog.MAX_DAILY_HOURS:
                raise BusinessRuleViolationError(
                    f"Total hours for {request.log_date} would exceed {TimeLog.MAX_DAILY_HOURS}h "
                    f"(existing: {existing_hours}h, new: {request.hours}h)"
                )

            hourly_rate = request.hourly_rate or project.default_hourly_rate

            time_log = TimeLog(
                tenant_id=tenant_id,
                user_id=user_id,
                project_id=request.project_id,
                task_id=request.task_id,
                hours=request.hours,
                log_date=request.log_date,
                description=request.description,
                billable=request.billable,
                hourly_rate=hourly_rate,
            )

            time_log = await self._uow.time_logs.add(time_log)
            await self._uow.commit()

        await self._events.publish(
            TimeLogCreated(
                tenant_id=tenant_id,
                time_log_id=time_log.id,
                user_id=user_id,
                project_id=request.project_id,
                hours=request.hours,
                log_date=request.log_date,
                description=request.description,
            )
        )

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
