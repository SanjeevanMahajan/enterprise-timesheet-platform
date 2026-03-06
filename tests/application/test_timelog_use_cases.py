import uuid
from datetime import date

import pytest

from src.application.dto.timelog_dto import CreateTimeLogRequest, UpdateTimeLogRequest
from src.application.use_cases.timelogs.create_time_log import CreateTimeLogUseCase
from src.application.use_cases.timelogs.list_time_logs import ListTimeLogsUseCase
from src.application.use_cases.timelogs.update_time_log import UpdateTimeLogUseCase
from src.domain.entities.project import Project
from src.domain.entities.time_log import TimeLog
from src.domain.events.timelog_events import TimeLogCreated
from src.domain.exceptions import BusinessRuleViolationError, EntityNotFoundError
from tests.conftest import TENANT_ID, USER_ID
from tests.fakes.services import FakeEventPublisher
from tests.fakes.unit_of_work import FakeUnitOfWork

PROJECT_ID = uuid.UUID("00000000-0000-0000-0000-000000000100")


@pytest.fixture
async def seeded_uow(uow: FakeUnitOfWork):
    await uow.projects.add(Project(
        tenant_id=TENANT_ID, name="P", owner_id=USER_ID, id=PROJECT_ID,
    ))
    return uow


class TestCreateTimeLog:
    @pytest.fixture
    def use_case(self, seeded_uow, events: FakeEventPublisher):
        return CreateTimeLogUseCase(seeded_uow, events)

    @pytest.mark.asyncio
    async def test_creates_time_log(self, use_case, seeded_uow):
        req = CreateTimeLogRequest(
            project_id=PROJECT_ID, hours=8.0, log_date=date(2026, 3, 2),
        )
        result = await use_case.execute(TENANT_ID, USER_ID, req)

        assert result.hours == 8.0
        assert result.user_id == USER_ID
        assert result.billable is True
        assert seeded_uow.committed is True

    @pytest.mark.asyncio
    async def test_publishes_event(self, use_case, events):
        req = CreateTimeLogRequest(project_id=PROJECT_ID, hours=4.0, log_date=date(2026, 3, 2))
        await use_case.execute(TENANT_ID, USER_ID, req)

        assert len(events.events) == 1
        assert isinstance(events.events[0], TimeLogCreated)
        assert events.events[0].hours == 4.0

    @pytest.mark.asyncio
    async def test_rejects_nonexistent_project(self, seeded_uow, events):
        uc = CreateTimeLogUseCase(seeded_uow, events)
        req = CreateTimeLogRequest(project_id=uuid.uuid4(), hours=1.0, log_date=date(2026, 3, 2))
        with pytest.raises(EntityNotFoundError):
            await uc.execute(TENANT_ID, USER_ID, req)

    @pytest.mark.asyncio
    async def test_daily_hours_cap(self, use_case, seeded_uow):
        # Pre-seed 20 hours on same day
        existing = TimeLog(
            tenant_id=TENANT_ID, user_id=USER_ID, project_id=PROJECT_ID,
            hours=20.0, log_date=date(2026, 3, 2),
        )
        await seeded_uow.time_logs.add(existing)

        req = CreateTimeLogRequest(project_id=PROJECT_ID, hours=5.0, log_date=date(2026, 3, 2))
        with pytest.raises(BusinessRuleViolationError, match="exceed"):
            await use_case.execute(TENANT_ID, USER_ID, req)

    @pytest.mark.asyncio
    async def test_allows_up_to_24_total(self, use_case, seeded_uow):
        existing = TimeLog(
            tenant_id=TENANT_ID, user_id=USER_ID, project_id=PROJECT_ID,
            hours=16.0, log_date=date(2026, 3, 2),
        )
        await seeded_uow.time_logs.add(existing)

        req = CreateTimeLogRequest(project_id=PROJECT_ID, hours=8.0, log_date=date(2026, 3, 2))
        result = await use_case.execute(TENANT_ID, USER_ID, req)
        assert result.hours == 8.0


class TestUpdateTimeLog:
    @pytest.fixture
    def use_case(self, seeded_uow):
        return UpdateTimeLogUseCase(seeded_uow)

    @pytest.mark.asyncio
    async def test_updates_hours(self, use_case, seeded_uow):
        tl = TimeLog(
            tenant_id=TENANT_ID, user_id=USER_ID, project_id=PROJECT_ID,
            hours=4.0, log_date=date(2026, 3, 2),
        )
        await seeded_uow.time_logs.add(tl)

        req = UpdateTimeLogRequest(hours=6.0)
        result = await use_case.execute(TENANT_ID, tl.id, req)
        assert result.hours == 6.0

    @pytest.mark.asyncio
    async def test_updates_description(self, use_case, seeded_uow):
        tl = TimeLog(
            tenant_id=TENANT_ID, user_id=USER_ID, project_id=PROJECT_ID,
            hours=4.0, log_date=date(2026, 3, 2),
        )
        await seeded_uow.time_logs.add(tl)

        req = UpdateTimeLogRequest(description="Updated")
        result = await use_case.execute(TENANT_ID, tl.id, req)
        assert result.description == "Updated"

    @pytest.mark.asyncio
    async def test_not_found(self, use_case):
        req = UpdateTimeLogRequest(hours=1.0)
        with pytest.raises(EntityNotFoundError):
            await use_case.execute(TENANT_ID, uuid.uuid4(), req)


class TestListTimeLogs:
    @pytest.fixture
    def use_case(self, seeded_uow):
        return ListTimeLogsUseCase(seeded_uow)

    @pytest.mark.asyncio
    async def test_list_by_user(self, use_case, seeded_uow):
        other_user = uuid.uuid4()
        await seeded_uow.time_logs.add(TimeLog(
            tenant_id=TENANT_ID, user_id=USER_ID, project_id=PROJECT_ID,
            hours=4.0, log_date=date(2026, 3, 2),
        ))
        await seeded_uow.time_logs.add(TimeLog(
            tenant_id=TENANT_ID, user_id=other_user, project_id=PROJECT_ID,
            hours=4.0, log_date=date(2026, 3, 2),
        ))

        result = await use_case.execute(TENANT_ID, user_id=USER_ID)
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_list_by_project(self, use_case, seeded_uow):
        other_project = uuid.uuid4()
        await seeded_uow.time_logs.add(TimeLog(
            tenant_id=TENANT_ID, user_id=USER_ID, project_id=PROJECT_ID,
            hours=4.0, log_date=date(2026, 3, 2),
        ))
        await seeded_uow.time_logs.add(TimeLog(
            tenant_id=TENANT_ID, user_id=USER_ID, project_id=other_project,
            hours=4.0, log_date=date(2026, 3, 2),
        ))

        result = await use_case.execute(TENANT_ID, project_id=PROJECT_ID)
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_date_range_filter(self, use_case, seeded_uow):
        await seeded_uow.time_logs.add(TimeLog(
            tenant_id=TENANT_ID, user_id=USER_ID, project_id=PROJECT_ID,
            hours=4.0, log_date=date(2026, 3, 1),
        ))
        await seeded_uow.time_logs.add(TimeLog(
            tenant_id=TENANT_ID, user_id=USER_ID, project_id=PROJECT_ID,
            hours=4.0, log_date=date(2026, 3, 5),
        ))
        await seeded_uow.time_logs.add(TimeLog(
            tenant_id=TENANT_ID, user_id=USER_ID, project_id=PROJECT_ID,
            hours=4.0, log_date=date(2026, 3, 10),
        ))

        result = await use_case.execute(
            TENANT_ID, user_id=USER_ID,
            start_date=date(2026, 3, 2), end_date=date(2026, 3, 8),
        )
        assert len(result) == 1
