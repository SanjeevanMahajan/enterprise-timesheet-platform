from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from src.application.dto.task_dto import (
    AssignTaskRequest,
    CreateTaskRequest,
    TaskResponse,
    UpdateTaskRequest,
)
from src.application.use_cases.tasks.assign_task import AssignTaskUseCase
from src.application.use_cases.tasks.create_task import CreateTaskUseCase
from src.application.use_cases.tasks.get_task import GetTaskUseCase
from src.application.use_cases.tasks.list_tasks import ListTasksUseCase
from src.application.use_cases.tasks.update_task import UpdateTaskUseCase
from src.domain.value_objects.enums import Role
from src.infrastructure.security.auth import CurrentUser, get_current_user, require_role
from src.presentation.dependencies import (
    get_assign_task_use_case,
    get_create_task_use_case,
    get_get_task_use_case,
    get_list_tasks_use_case,
    get_update_task_use_case,
)

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    project_id: uuid.UUID | None = Query(None),
    assignee_id: uuid.UUID | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    use_case: ListTasksUseCase = Depends(get_list_tasks_use_case),
) -> list[TaskResponse]:
    return await use_case.execute(
        current_user.tenant_id,
        project_id=project_id,
        assignee_id=assignee_id,
        offset=offset,
        limit=limit,
    )


@router.post("", response_model=TaskResponse, status_code=201)
async def create_task(
    body: CreateTaskRequest,
    current_user: CurrentUser = Depends(require_role(Role.ADMIN, Role.MANAGER, Role.MEMBER)),
    use_case: CreateTaskUseCase = Depends(get_create_task_use_case),
) -> TaskResponse:
    return await use_case.execute(current_user.tenant_id, body)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    use_case: GetTaskUseCase = Depends(get_get_task_use_case),
) -> TaskResponse:
    return await use_case.execute(current_user.tenant_id, task_id)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: uuid.UUID,
    body: UpdateTaskRequest,
    current_user: CurrentUser = Depends(require_role(Role.ADMIN, Role.MANAGER, Role.MEMBER)),
    use_case: UpdateTaskUseCase = Depends(get_update_task_use_case),
) -> TaskResponse:
    return await use_case.execute(current_user.tenant_id, task_id, body)


@router.post("/{task_id}/assign", response_model=TaskResponse)
async def assign_task(
    task_id: uuid.UUID,
    body: AssignTaskRequest,
    current_user: CurrentUser = Depends(require_role(Role.ADMIN, Role.MANAGER)),
    use_case: AssignTaskUseCase = Depends(get_assign_task_use_case),
) -> TaskResponse:
    return await use_case.execute(current_user.tenant_id, task_id, body)
