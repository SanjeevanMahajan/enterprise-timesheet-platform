from __future__ import annotations

import uuid
from datetime import date

from src.application.dto.timelog_dto import TimeLogResponse
from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.value_objects.enums import ApprovalStatus


class ListTimeLogsUseCase:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def execute(
        self,
        tenant_id: uuid.UUID,
        *,
        user_id: uuid.UUID | None = None,
        project_id: uuid.UUID | None = None,
        approval_status: ApprovalStatus | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[TimeLogResponse]:
        async with self._uow:
            if approval_status is not None:
                logs = await self._uow.time_logs.list_by_approval_status(
                    tenant_id, approval_status, offset=offset, limit=limit
                )
            elif user_id is not None:
                logs = await self._uow.time_logs.list_by_user(
                    tenant_id,
                    user_id,
                    start_date=start_date,
                    end_date=end_date,
                    offset=offset,
                    limit=limit,
                )
            elif project_id is not None:
                logs = await self._uow.time_logs.list_by_project(
                    tenant_id,
                    project_id,
                    start_date=start_date,
                    end_date=end_date,
                    offset=offset,
                    limit=limit,
                )
            else:
                logs = await self._uow.time_logs.list(
                    tenant_id, offset=offset, limit=limit
                )

        return [
            TimeLogResponse(
                id=tl.id,
                tenant_id=tl.tenant_id,
                user_id=tl.user_id,
                project_id=tl.project_id,
                task_id=tl.task_id,
                hours=tl.hours,
                log_date=tl.log_date,
                description=tl.description,
                billable=tl.billable,
                hourly_rate=tl.hourly_rate,
                billable_amount=tl.billable_amount,
                timer_started_at=tl.timer_started_at,
                timer_stopped_at=tl.timer_stopped_at,
                is_timer_running=tl.is_timer_running,
                timer_status=tl.timer_status,
                accumulated_seconds=tl.accumulated_seconds,
                is_timer_paused=tl.is_timer_paused,
                approval_status=tl.approval_status,
                ai_category=tl.ai_category,
                ai_quality_score=tl.ai_quality_score,
                ai_suggestion=tl.ai_suggestion,
                created_at=tl.created_at,
                updated_at=tl.updated_at,
            )
            for tl in logs
        ]
