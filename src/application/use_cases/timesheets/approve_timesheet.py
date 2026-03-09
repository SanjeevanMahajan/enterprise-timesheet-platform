from __future__ import annotations

import uuid

from src.application.dto.timesheet_dto import TimesheetResponse
from src.application.interfaces.event_publisher import EventPublisher
from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.events.timelog_events import TimeLogApproved
from src.domain.events.timesheet_events import TimesheetApproved
from src.domain.exceptions import EntityNotFoundError


class ApproveTimesheetUseCase:
    def __init__(self, uow: UnitOfWork, events: EventPublisher) -> None:
        self._uow = uow
        self._events = events

    async def execute(
        self,
        tenant_id: uuid.UUID,
        timesheet_id: uuid.UUID,
        approver_id: uuid.UUID,
    ) -> TimesheetResponse:
        approved_logs = []

        async with self._uow:
            timesheet = await self._uow.timesheets.get_by_id(tenant_id, timesheet_id)
            if timesheet is None:
                raise EntityNotFoundError("Timesheet", timesheet_id)

            timesheet.approve(approver_id)
            timesheet = await self._uow.timesheets.update(timesheet)

            # Cascade: approve all linked time logs
            time_logs = await self._uow.time_logs.list_by_timesheet(
                tenant_id, timesheet_id
            )
            for tl in time_logs:
                tl.approve()
                await self._uow.time_logs.update(tl)
                approved_logs.append(tl)

            await self._uow.commit()

        # Publish timesheet-level event
        await self._events.publish(
            TimesheetApproved(
                tenant_id=tenant_id,
                timesheet_id=timesheet.id,
                user_id=timesheet.user_id,
                approved_by=approver_id,
            )
        )

        # Publish individual TimeLogApproved events — this gates the AI + Billing pipeline
        for tl in approved_logs:
            await self._events.publish(
                TimeLogApproved(
                    tenant_id=tenant_id,
                    time_log_id=tl.id,
                    user_id=tl.user_id,
                    project_id=tl.project_id,
                    hours=tl.hours,
                    log_date=tl.log_date,
                    description=tl.description,
                    billable=tl.billable,
                    hourly_rate=tl.hourly_rate,
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
