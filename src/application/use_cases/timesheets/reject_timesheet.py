from __future__ import annotations

import uuid

from src.application.dto.timesheet_dto import RejectTimesheetRequest, TimesheetResponse
from src.application.interfaces.event_publisher import EventPublisher
from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.events.timelog_events import TimeLogRejected
from src.domain.events.timesheet_events import TimesheetRejected
from src.domain.exceptions import EntityNotFoundError


class RejectTimesheetUseCase:
    def __init__(self, uow: UnitOfWork, events: EventPublisher) -> None:
        self._uow = uow
        self._events = events

    async def execute(
        self,
        tenant_id: uuid.UUID,
        timesheet_id: uuid.UUID,
        approver_id: uuid.UUID,
        request: RejectTimesheetRequest,
    ) -> TimesheetResponse:
        rejected_logs = []

        async with self._uow:
            timesheet = await self._uow.timesheets.get_by_id(tenant_id, timesheet_id)
            if timesheet is None:
                raise EntityNotFoundError("Timesheet", timesheet_id)

            timesheet.reject(approver_id, request.reason)
            timesheet = await self._uow.timesheets.update(timesheet)

            # Cascade: reject all linked time logs
            time_logs = await self._uow.time_logs.list_by_timesheet(
                tenant_id, timesheet_id
            )
            for tl in time_logs:
                tl.reject(request.reason)
                await self._uow.time_logs.update(tl)
                rejected_logs.append(tl)

            await self._uow.commit()

        # Publish timesheet-level event
        await self._events.publish(
            TimesheetRejected(
                tenant_id=tenant_id,
                timesheet_id=timesheet.id,
                user_id=timesheet.user_id,
                rejected_by=approver_id,
                reason=request.reason,
            )
        )

        # Publish individual TimeLogRejected events
        for tl in rejected_logs:
            await self._events.publish(
                TimeLogRejected(
                    tenant_id=tenant_id,
                    time_log_id=tl.id,
                    user_id=tl.user_id,
                    reason=request.reason,
                )
            )

        return TimesheetResponse(
            id=timesheet.id,
            tenant_id=timesheet.tenant_id,
            user_id=timesheet.user_id,
            week_start=timesheet.week_start,
            week_end=timesheet.week_end,
            total_hours=timesheet.total_hours,
            status=timesheet.status,
            approved_by=timesheet.approved_by,
            rejection_reason=timesheet.rejection_reason,
            created_at=timesheet.created_at,
            updated_at=timesheet.updated_at,
        )
