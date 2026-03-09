from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query

from src.application.dto.timelog_dto import (
    CreateTimeLogRequest,
    RejectRequest,
    StartTimerRequest,
    TimeLogResponse,
    UpdateTimeLogRequest,
)
from src.application.use_cases.timelogs.create_time_log import CreateTimeLogUseCase
from src.application.use_cases.timelogs.list_time_logs import ListTimeLogsUseCase
from src.application.use_cases.timelogs.manager_approve import ManagerApproveUseCase
from src.application.use_cases.timelogs.manager_reject import ManagerRejectUseCase
from src.application.use_cases.timelogs.pause_timer import PauseTimerUseCase
from src.application.use_cases.timelogs.resume_timer import ResumeTimerUseCase
from src.application.use_cases.timelogs.start_timer import StartTimerUseCase
from src.application.use_cases.timelogs.stop_timer import StopTimerUseCase
from src.application.use_cases.timelogs.update_time_log import UpdateTimeLogUseCase
from src.domain.value_objects.enums import ApprovalStatus, Role
from src.infrastructure.security.auth import CurrentUser, get_current_user, require_role
from src.presentation.dependencies import (
    get_create_time_log_use_case,
    get_list_time_logs_use_case,
    get_manager_approve_use_case,
    get_manager_reject_use_case,
    get_pause_timer_use_case,
    get_resume_timer_use_case,
    get_start_timer_use_case,
    get_stop_timer_use_case,
    get_update_time_log_use_case,
)

router = APIRouter(prefix="/timelogs", tags=["Time Logs"])


@router.get("", response_model=list[TimeLogResponse])
async def list_time_logs(
    user_id: uuid.UUID | None = Query(None),
    project_id: uuid.UUID | None = Query(None),
    approval_status: str | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    use_case: ListTimeLogsUseCase = Depends(get_list_time_logs_use_case),
) -> list[TimeLogResponse]:
    parsed_status = ApprovalStatus(approval_status) if approval_status else None
    return await use_case.execute(
        current_user.tenant_id,
        user_id=user_id,
        project_id=project_id,
        approval_status=parsed_status,
        start_date=start_date,
        end_date=end_date,
        offset=offset,
        limit=limit,
    )


@router.post("", response_model=TimeLogResponse, status_code=201)
async def create_time_log(
    body: CreateTimeLogRequest,
    current_user: CurrentUser = Depends(get_current_user),
    use_case: CreateTimeLogUseCase = Depends(get_create_time_log_use_case),
) -> TimeLogResponse:
    return await use_case.execute(current_user.tenant_id, current_user.user_id, body)


# ── Timer operations ─────────────────────────────────────────────────────

@router.post("/timer/start", response_model=TimeLogResponse, status_code=201)
async def start_timer(
    body: StartTimerRequest,
    current_user: CurrentUser = Depends(get_current_user),
    use_case: StartTimerUseCase = Depends(get_start_timer_use_case),
) -> TimeLogResponse:
    return await use_case.execute(current_user.tenant_id, current_user.user_id, body)


@router.post("/{time_log_id}/timer/pause", response_model=TimeLogResponse)
async def pause_timer(
    time_log_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    use_case: PauseTimerUseCase = Depends(get_pause_timer_use_case),
) -> TimeLogResponse:
    return await use_case.execute(current_user.tenant_id, time_log_id)


@router.post("/{time_log_id}/timer/resume", response_model=TimeLogResponse)
async def resume_timer(
    time_log_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    use_case: ResumeTimerUseCase = Depends(get_resume_timer_use_case),
) -> TimeLogResponse:
    return await use_case.execute(current_user.tenant_id, time_log_id)


@router.post("/{time_log_id}/timer/stop", response_model=TimeLogResponse)
async def stop_timer(
    time_log_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    use_case: StopTimerUseCase = Depends(get_stop_timer_use_case),
) -> TimeLogResponse:
    return await use_case.execute(current_user.tenant_id, time_log_id)


# ── Manager approval ─────────────────────────────────────────────────────

@router.post("/{time_log_id}/manager-approve", response_model=TimeLogResponse)
async def manager_approve(
    time_log_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(Role.ADMIN, Role.MANAGER)),
    use_case: ManagerApproveUseCase = Depends(get_manager_approve_use_case),
) -> TimeLogResponse:
    return await use_case.execute(current_user.tenant_id, time_log_id)


@router.post("/{time_log_id}/manager-reject", response_model=TimeLogResponse)
async def manager_reject(
    time_log_id: uuid.UUID,
    body: RejectRequest,
    current_user: CurrentUser = Depends(require_role(Role.ADMIN, Role.MANAGER)),
    use_case: ManagerRejectUseCase = Depends(get_manager_reject_use_case),
) -> TimeLogResponse:
    return await use_case.execute(current_user.tenant_id, time_log_id, body)


@router.put("/{time_log_id}", response_model=TimeLogResponse)
async def update_time_log(
    time_log_id: uuid.UUID,
    body: UpdateTimeLogRequest,
    current_user: CurrentUser = Depends(get_current_user),
    use_case: UpdateTimeLogUseCase = Depends(get_update_time_log_use_case),
) -> TimeLogResponse:
    return await use_case.execute(current_user.tenant_id, time_log_id, body)
