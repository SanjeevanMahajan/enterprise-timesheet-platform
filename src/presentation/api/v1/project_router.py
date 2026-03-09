from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.application.dto.project_dto import (
    CreateProjectRequest,
    ProjectResponse,
    UpdateProjectRequest,
)
from src.application.use_cases.projects.create_project import CreateProjectUseCase
from src.application.use_cases.projects.delete_project import DeleteProjectUseCase
from src.application.use_cases.projects.get_project import GetProjectUseCase
from src.application.use_cases.projects.list_projects import ListProjectsUseCase
from src.application.use_cases.projects.update_project import UpdateProjectUseCase
from src.domain.value_objects.enums import Role
from src.infrastructure.security.auth import CurrentUser, get_current_user, require_role
from src.presentation.dependencies import (
    get_create_project_use_case,
    get_delete_project_use_case,
    get_get_project_use_case,
    get_list_projects_use_case,
    get_update_project_use_case,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    use_case: ListProjectsUseCase = Depends(get_list_projects_use_case),
) -> list[ProjectResponse]:
    return await use_case.execute(
        current_user.tenant_id,
        offset=offset,
        limit=limit,
        client_id=current_user.client_id if current_user.role == Role.CLIENT else None,
    )


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    body: CreateProjectRequest,
    current_user: CurrentUser = Depends(require_role(Role.ADMIN, Role.MANAGER)),
    use_case: CreateProjectUseCase = Depends(get_create_project_use_case),
) -> ProjectResponse:
    return await use_case.execute(current_user.tenant_id, current_user.user_id, body)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    use_case: GetProjectUseCase = Depends(get_get_project_use_case),
) -> ProjectResponse:
    project = await use_case.execute(current_user.tenant_id, project_id)
    if current_user.role == Role.CLIENT and project.client_id != current_user.client_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: uuid.UUID,
    body: UpdateProjectRequest,
    current_user: CurrentUser = Depends(require_role(Role.ADMIN, Role.MANAGER)),
    use_case: UpdateProjectUseCase = Depends(get_update_project_use_case),
) -> ProjectResponse:
    return await use_case.execute(current_user.tenant_id, project_id, body)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role(Role.ADMIN)),
    use_case: DeleteProjectUseCase = Depends(get_delete_project_use_case),
) -> None:
    await use_case.execute(current_user.tenant_id, project_id)
