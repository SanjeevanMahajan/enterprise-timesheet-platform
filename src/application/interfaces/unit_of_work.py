from __future__ import annotations

from abc import ABC, abstractmethod
from types import TracebackType

from src.domain.repositories import (
    ProjectRepository,
    TaskRepository,
    TimeLogRepository,
    TimesheetRepository,
    UserRepository,
)


class UnitOfWork(ABC):
    """Coordinates transactional boundaries across multiple repositories.

    Usage:
        async with uow:
            project = await uow.projects.get_by_id(tid, pid)
            project.transition_to(ProjectStatus.COMPLETED)
            await uow.projects.update(project)
            await uow.commit()
    """

    users: UserRepository
    projects: ProjectRepository
    tasks: TaskRepository
    time_logs: TimeLogRepository
    timesheets: TimesheetRepository

    @abstractmethod
    async def commit(self) -> None: ...

    @abstractmethod
    async def rollback(self) -> None: ...

    async def __aenter__(self) -> UnitOfWork:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        if exc_type is not None:
            await self.rollback()
