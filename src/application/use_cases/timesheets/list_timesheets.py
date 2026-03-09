from __future__ import annotations

import uuid

from src.application.dto.timesheet_dto import TimesheetResponse
from src.application.interfaces.unit_of_work import UnitOfWork


class ListTimesheetsUseCase:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def execute(
        self,
        tenant_id: uuid.UUID,
        *,
        user_id: uuid.UUID | None = None,
        pending_only: bool = False,
        offset: int = 0,
        limit: int = 50,
    ) -> list[TimesheetResponse]:
        async with self._uow:
            if pending_only:
                timesheets = await self._uow.timesheets.list_pending_approval(
                    tenant_id, offset=offset, limit=limit
                )
            elif user_id is not None:
                timesheets = await self._uow.timesheets.list_by_user(
                    tenant_id, user_id, offset=offset, limit=limit
                )
            else:
                timesheets = await self._uow.timesheets.list_pending_approval(
                    tenant_id, offset=offset, limit=limit
                )

        return [
            TimesheetResponse(
                id=ts.id,
                tenant_id=ts.tenant_id,
                user_id=ts.user_id,
                week_start=ts.week_start,
                week_end=ts.week_end,
                total_hours=ts.total_hours,
                status=ts.status,
                approved_by=ts.approved_by,
                rejection_reason=ts.rejection_reason,
                created_at=ts.created_at,
                updated_at=ts.updated_at,
            )
            for ts in timesheets
        ]
