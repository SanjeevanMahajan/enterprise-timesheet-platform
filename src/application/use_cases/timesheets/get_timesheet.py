from __future__ import annotations

import uuid

from src.application.dto.timesheet_dto import TimesheetResponse
from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.exceptions import EntityNotFoundError


class GetTimesheetUseCase:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def execute(
        self,
        tenant_id: uuid.UUID,
        timesheet_id: uuid.UUID,
    ) -> TimesheetResponse:
        async with self._uow:
            timesheet = await self._uow.timesheets.get_by_id(tenant_id, timesheet_id)
            if timesheet is None:
                raise EntityNotFoundError("Timesheet", timesheet_id)

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
