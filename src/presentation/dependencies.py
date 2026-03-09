"""Composition root: wires concrete infrastructure into application use cases.

Each function here is a FastAPI dependency that constructs a fully-wired use case.
This is the ONLY place where infrastructure imports leak into the presentation layer.
"""

from __future__ import annotations

import os

import redis.asyncio as aioredis

from src.application.interfaces.unit_of_work import UnitOfWork
from src.application.use_cases.projects.create_project import CreateProjectUseCase
from src.application.use_cases.projects.delete_project import DeleteProjectUseCase
from src.application.use_cases.projects.get_project import GetProjectUseCase
from src.application.use_cases.projects.list_projects import ListProjectsUseCase
from src.application.use_cases.projects.update_project import UpdateProjectUseCase
from src.application.use_cases.tasks.assign_task import AssignTaskUseCase
from src.application.use_cases.tasks.create_task import CreateTaskUseCase
from src.application.use_cases.tasks.get_task import GetTaskUseCase
from src.application.use_cases.tasks.list_tasks import ListTasksUseCase
from src.application.use_cases.tasks.update_task import UpdateTaskUseCase
from src.application.use_cases.timelogs.create_time_log import CreateTimeLogUseCase
from src.application.use_cases.timelogs.list_time_logs import ListTimeLogsUseCase
from src.application.use_cases.timelogs.manager_approve import ManagerApproveUseCase
from src.application.use_cases.timelogs.manager_reject import ManagerRejectUseCase
from src.application.use_cases.timelogs.pause_timer import PauseTimerUseCase
from src.application.use_cases.timelogs.resume_timer import ResumeTimerUseCase
from src.application.use_cases.timelogs.start_timer import StartTimerUseCase
from src.application.use_cases.timelogs.stop_timer import StopTimerUseCase
from src.application.use_cases.timelogs.update_time_log import UpdateTimeLogUseCase
from src.application.use_cases.timesheets.approve_timesheet import ApproveTimesheetUseCase
from src.application.use_cases.timesheets.get_timesheet import GetTimesheetUseCase
from src.application.use_cases.timesheets.list_timesheets import ListTimesheetsUseCase
from src.application.use_cases.timesheets.reject_timesheet import RejectTimesheetUseCase
from src.application.use_cases.timesheets.submit_timesheet import SubmitTimesheetUseCase
from src.application.use_cases.users.authenticate_user import AuthenticateUserUseCase
from src.application.use_cases.users.register_user import RegisterUserUseCase
from src.infrastructure.cache.redis_cache import RedisCache
from src.infrastructure.database.session import async_session_factory
from src.infrastructure.database.unit_of_work import SQLAlchemyUnitOfWork
from src.infrastructure.messaging.redis_event_publisher import RedisEventPublisher
from src.infrastructure.security.jwt_handler import JWTTokenService
from src.infrastructure.security.password import BcryptPasswordHasher


# -- Singletons (stateless, safe to reuse) ------------------------------------

_hasher = BcryptPasswordHasher()
_token_service = JWTTokenService()

_redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
_redis = aioredis.from_url(_redis_url, decode_responses=True)
_event_publisher = RedisEventPublisher(_redis)
_cache = RedisCache(_redis)


# -- Factory helpers -----------------------------------------------------------

def _uow() -> UnitOfWork:
    return SQLAlchemyUnitOfWork(async_session_factory)


# -- Auth use cases ------------------------------------------------------------

def get_register_user_use_case() -> RegisterUserUseCase:
    return RegisterUserUseCase(_uow(), _hasher, _event_publisher)


def get_authenticate_user_use_case() -> AuthenticateUserUseCase:
    return AuthenticateUserUseCase(_uow(), _hasher, _token_service)


# -- Project use cases ---------------------------------------------------------

def get_create_project_use_case() -> CreateProjectUseCase:
    return CreateProjectUseCase(_uow(), _event_publisher, _cache)


def get_update_project_use_case() -> UpdateProjectUseCase:
    return UpdateProjectUseCase(_uow(), _event_publisher, _cache)


def get_get_project_use_case() -> GetProjectUseCase:
    return GetProjectUseCase(_uow())


def get_list_projects_use_case() -> ListProjectsUseCase:
    return ListProjectsUseCase(_uow(), _cache)


def get_delete_project_use_case() -> DeleteProjectUseCase:
    return DeleteProjectUseCase(_uow(), _cache)


# -- Task use cases ------------------------------------------------------------

def get_create_task_use_case() -> CreateTaskUseCase:
    return CreateTaskUseCase(_uow(), _event_publisher)


def get_update_task_use_case() -> UpdateTaskUseCase:
    return UpdateTaskUseCase(_uow(), _event_publisher)


def get_assign_task_use_case() -> AssignTaskUseCase:
    return AssignTaskUseCase(_uow(), _event_publisher)


def get_get_task_use_case() -> GetTaskUseCase:
    return GetTaskUseCase(_uow())


def get_list_tasks_use_case() -> ListTasksUseCase:
    return ListTasksUseCase(_uow())


# -- TimeLog use cases ---------------------------------------------------------

def get_create_time_log_use_case() -> CreateTimeLogUseCase:
    return CreateTimeLogUseCase(_uow(), _event_publisher)


def get_update_time_log_use_case() -> UpdateTimeLogUseCase:
    return UpdateTimeLogUseCase(_uow())


def get_list_time_logs_use_case() -> ListTimeLogsUseCase:
    return ListTimeLogsUseCase(_uow())


def get_start_timer_use_case() -> StartTimerUseCase:
    return StartTimerUseCase(_uow(), _event_publisher)


def get_stop_timer_use_case() -> StopTimerUseCase:
    return StopTimerUseCase(_uow(), _event_publisher)


def get_pause_timer_use_case() -> PauseTimerUseCase:
    return PauseTimerUseCase(_uow(), _event_publisher)


def get_resume_timer_use_case() -> ResumeTimerUseCase:
    return ResumeTimerUseCase(_uow(), _event_publisher)


def get_manager_approve_use_case() -> ManagerApproveUseCase:
    return ManagerApproveUseCase(_uow(), _event_publisher)


def get_manager_reject_use_case() -> ManagerRejectUseCase:
    return ManagerRejectUseCase(_uow(), _event_publisher)


# -- Timesheet use cases -------------------------------------------------------

def get_submit_timesheet_use_case() -> SubmitTimesheetUseCase:
    return SubmitTimesheetUseCase(_uow(), _event_publisher)


def get_list_timesheets_use_case() -> ListTimesheetsUseCase:
    return ListTimesheetsUseCase(_uow())


def get_approve_timesheet_use_case() -> ApproveTimesheetUseCase:
    return ApproveTimesheetUseCase(_uow(), _event_publisher)


def get_reject_timesheet_use_case() -> RejectTimesheetUseCase:
    return RejectTimesheetUseCase(_uow(), _event_publisher)


def get_get_timesheet_use_case() -> GetTimesheetUseCase:
    return GetTimesheetUseCase(_uow())


# -- Webhook dependencies ------------------------------------------------------

def get_webhook_uow() -> UnitOfWork:
    """Return a UnitOfWork with webhooks repository for the webhook router."""
    return _uow()
