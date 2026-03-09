from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from src.application.dto.timesheet_dto import (
    CreateTimesheetRequest,
    RejectTimesheetRequest,
    TimesheetResponse,
)
from src.application.use_cases.timesheets.approve_timesheet import ApproveTimesheetUseCase
from src.application.use_cases.timesheets.get_timesheet import GetTimesheetUseCase
from src.application.use_cases.timesheets.list_timesheets import ListTimesheetsUseCase
from src.application.use_cases.timesheets.reject_timesheet import RejectTimesheetUseCase
from src.application.use_cases.timesheets.submit_timesheet import SubmitTimesheetUseCase
from src.domain.value_objects.enums import Role
from src.infrastructure.security.auth import CurrentUser, get_current_user, require_role
from src.presentation.dependencies import (
    get_approve_timesheet_use_case,
    get_get_timesheet_use_case,
    get_list_timesheets_use_case,
    get_reject_timesheet_use_case,
    get_submit_timesheet_use_case,
)

router = APIRouter(prefix="/timesheets", tags=["Timesheets"])


@router.post("/submit", response_model=TimesheetResponse, status_code=201)
async def submit_timesheet(
    body: CreateTimesheetRequest,
    current_user: CurrentUser = Depends(get_current_user),
    use_case: SubmitTimesheetUseCase = Depends(get_submit_timesheet_use_case),
) -> TimesheetResponse:
    return await use_case.execute(current_user.tenant_id, current_user.user_id, body)


@router.get("/", response_model=list[TimesheetResponse])
async def list_my_timesheets(
    current_user: CurrentUser = Depends(get_current_user),
    use_case: ListTimesheetsUseCase = Depends(get_list_timesheets_use_case),
) -> list[TimesheetResponse]:
    """List timesheets for the current user."""
    return await use_case.execute(
        current_user.tenant_id, user_id=current_user.user_id
    )


@router.get("/pending", response_model=list[TimesheetResponse])
async def list_pending_timesheets(
    current_user: CurrentUser = Depends(require_role(Role.ADMIN, Role.MANAGER)),
    use_case: ListTimesheetsUseCase = Depends(get_list_timesheets_use_case),
) -> list[TimesheetResponse]:
    """List all pending timesheets for manager review."""
    return await use_case.execute(
        current_user.tenant_id, pending_only=True
    )


@router.get("/{timesheet_id}", response_model=TimesheetResponse)
async def get_timesheet(
    timesheet_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    use_case: GetTimesheetUseCase = Depends(get_get_timesheet_use_case),
) -> TimesheetResponse:
    return await use_case.execute(current_user.tenant_id, timesheet_id)


@router.post("/{timesheet_id}/approve", response_model=TimesheetResponse)
async def approve_timesheet(
    timesheet_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(Role.ADMIN, Role.MANAGER)),
    use_case: ApproveTimesheetUseCase = Depends(get_approve_timesheet_use_case),
) -> TimesheetResponse:
    return await use_case.execute(
        current_user.tenant_id, timesheet_id, current_user.user_id
    )


@router.post("/{timesheet_id}/reject", response_model=TimesheetResponse)
async def reject_timesheet(
    timesheet_id: uuid.UUID,
    body: RejectTimesheetRequest,
    current_user: CurrentUser = Depends(require_role(Role.ADMIN, Role.MANAGER)),
    use_case: RejectTimesheetUseCase = Depends(get_reject_timesheet_use_case),
) -> TimesheetResponse:
    return await use_case.execute(
        current_user.tenant_id, timesheet_id, current_user.user_id, body
    )
