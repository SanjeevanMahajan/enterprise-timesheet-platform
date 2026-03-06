from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query

from src.application.dto.timelog_dto import (
    CreateTimeLogRequest,
    StartTimerRequest,
    TimeLogResponse,
    UpdateTimeLogRequest,
)
from src.application.use_cases.timelogs.create_time_log import CreateTimeLogUseCase
from src.application.use_cases.timelogs.list_time_logs import ListTimeLogsUseCase
from src.application.use_cases.timelogs.start_timer import StartTimerUseCase
from src.application.use_cases.timelogs.stop_timer import StopTimerUseCase
from src.application.use_cases.timelogs.update_time_log import UpdateTimeLogUseCase
from src.infrastructure.security.auth import CurrentUser, get_current_user
from src.presentation.dependencies import (
    get_create_time_log_use_case,
    get_list_time_logs_use_case,
    get_start_timer_use_case,
    get_stop_timer_use_case,
    get_update_time_log_use_case,
)

router = APIRouter(prefix="/timelogs", tags=["Time Logs"])


@router.get("", response_model=list[TimeLogResponse])
async def list_time_logs(
    user_id: uuid.UUID | None = Query(None),
    project_id: uuid.UUID | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    use_case: ListTimeLogsUseCase = Depends(get_list_time_logs_use_case),
) -> list[TimeLogResponse]:
    return await use_case.execute(
        current_user.tenant_id,
        user_id=user_id,
        project_id=project_id,
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


@router.post("/timer/start", response_model=TimeLogResponse, status_code=201)
async def start_timer(
    body: StartTimerRequest,
    current_user: CurrentUser = Depends(get_current_user),
    use_case: StartTimerUseCase = Depends(get_start_timer_use_case),
) -> TimeLogResponse:
    return await use_case.execute(current_user.tenant_id, current_user.user_id, body)


@router.post("/{time_log_id}/timer/stop", response_model=TimeLogResponse)
async def stop_timer(
    time_log_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    use_case: StopTimerUseCase = Depends(get_stop_timer_use_case),
) -> TimeLogResponse:
    return await use_case.execute(current_user.tenant_id, time_log_id)


@router.put("/{time_log_id}", response_model=TimeLogResponse)
async def update_time_log(
    time_log_id: uuid.UUID,
    body: UpdateTimeLogRequest,
    current_user: CurrentUser = Depends(get_current_user),
    use_case: UpdateTimeLogUseCase = Depends(get_update_time_log_use_case),
) -> TimeLogResponse:
    return await use_case.execute(current_user.tenant_id, time_log_id, body)
