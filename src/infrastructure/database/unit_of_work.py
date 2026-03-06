from __future__ import annotations

from types import TracebackType

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.application.interfaces.unit_of_work import UnitOfWork
from src.infrastructure.database.repositories.project_repository import (
    SQLAlchemyProjectRepository,
)
from src.infrastructure.database.repositories.task_repository import (
    SQLAlchemyTaskRepository,
)
from src.infrastructure.database.repositories.time_log_repository import (
    SQLAlchemyTimeLogRepository,
)
from src.infrastructure.database.repositories.timesheet_repository import (
    SQLAlchemyTimesheetRepository,
)
from src.infrastructure.database.repositories.user_repository import (
    SQLAlchemyUserRepository,
)


class SQLAlchemyUnitOfWork(UnitOfWork):
    """Coordinates a single database transaction across multiple repositories.

    All repositories share the same AsyncSession, so a single commit()
    persists changes from every repository atomically.
    """

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def __aenter__(self) -> SQLAlchemyUnitOfWork:
        self._session = self._session_factory()
        self.users = SQLAlchemyUserRepository(self._session)
        self.projects = SQLAlchemyProjectRepository(self._session)
        self.tasks = SQLAlchemyTaskRepository(self._session)
        self.time_logs = SQLAlchemyTimeLogRepository(self._session)
        self.timesheets = SQLAlchemyTimesheetRepository(self._session)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        if exc_type is not None:
            await self.rollback()
        await self._session.close()

    async def commit(self) -> None:
        await self._session.commit()

    async def rollback(self) -> None:
        await self._session.rollback()
