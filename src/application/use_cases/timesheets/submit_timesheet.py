from __future__ import annotations

import uuid

from src.application.dto.timesheet_dto import CreateTimesheetRequest, TimesheetResponse
from src.application.interfaces.event_publisher import EventPublisher
from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.timesheet import Timesheet
from src.domain.events.timesheet_events import TimesheetSubmitted
from src.domain.exceptions import BusinessRuleViolationError
from src.domain.value_objects.enums import ApprovalStatus, TimesheetStatus


class SubmitTimesheetUseCase:
    def __init__(self, uow: UnitOfWork, events: EventPublisher) -> None:
        self._uow = uow
        self._events = events

    async def execute(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        request: CreateTimesheetRequest,
    ) -> TimesheetResponse:
        async with self._uow:
            existing = await self._uow.timesheets.get_by_user_and_week(
                tenant_id, user_id, request.week_start
            )
            if existing is not None and existing.status.value not in ("draft", "rejected"):
                raise BusinessRuleViolationError(
                    f"Timesheet for week {request.week_start} already exists "
                    f"with status '{existing.status}'"
                )

            # Collect all time logs for the user in the date range
            time_logs = await self._uow.time_logs.list_by_user(
                tenant_id,
                user_id,
                start_date=request.week_start,
                end_date=request.week_end,
            )
            total_hours = sum(tl.hours for tl in time_logs)

            if existing is not None:
                existing.total_hours = total_hours
                if existing.status == TimesheetStatus.REJECTED:
                    existing.reopen()
                existing.submit()
                timesheet = await self._uow.timesheets.update(existing)
            else:
                timesheet = Timesheet(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    week_start=request.week_start,
                    week_end=request.week_end,
                    total_hours=total_hours,
                )
                timesheet.submit()
                timesheet = await self._uow.timesheets.add(timesheet)

            # Link each time log to this timesheet and set to pending_manager
            for tl in time_logs:
                tl.timesheet_id = timesheet.id
                tl.approval_status = ApprovalStatus.PENDING_MANAGER
                tl.touch()
                await self._uow.time_logs.update(tl)

            await self._uow.commit()

        await self._events.publish(
            TimesheetSubmitted(
                tenant_id=tenant_id,
                timesheet_id=timesheet.id,
                user_id=user_id,
                total_hours=total_hours,
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
