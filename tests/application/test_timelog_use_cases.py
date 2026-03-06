import uuid
from datetime import date, datetime, timedelta

import pytest

from src.application.dto.timelog_dto import CreateTimeLogRequest, StartTimerRequest, UpdateTimeLogRequest
from src.application.use_cases.timelogs.create_time_log import CreateTimeLogUseCase
from src.application.use_cases.timelogs.list_time_logs import ListTimeLogsUseCase
from src.application.use_cases.timelogs.start_timer import StartTimerUseCase
from src.application.use_cases.timelogs.stop_timer import StopTimerUseCase
from src.application.use_cases.timelogs.update_time_log import UpdateTimeLogUseCase
from src.domain.entities.project import Project
from src.domain.entities.time_log import TimeLog
from src.domain.events.timelog_events import TimeLogCreated, TimerStarted, TimerStopped
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


@pytest.fixture
async def billable_uow(uow: FakeUnitOfWork):
    """UoW with a project that has a default hourly rate."""
    await uow.projects.add(Project(
        tenant_id=TENANT_ID, name="Billable Project", owner_id=USER_ID,
        id=PROJECT_ID, is_billable=True, default_hourly_rate=100.0,
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

    @pytest.mark.asyncio
    async def test_inherits_project_hourly_rate(self, billable_uow, events):
        uc = CreateTimeLogUseCase(billable_uow, events)
        req = CreateTimeLogRequest(
            project_id=PROJECT_ID, hours=4.0, log_date=date(2026, 3, 2),
        )
        result = await uc.execute(TENANT_ID, USER_ID, req)
        assert result.hourly_rate == 100.0
        assert result.billable_amount == 400.0

    @pytest.mark.asyncio
    async def test_explicit_rate_overrides_project_default(self, billable_uow, events):
        uc = CreateTimeLogUseCase(billable_uow, events)
        req = CreateTimeLogRequest(
            project_id=PROJECT_ID, hours=2.0, log_date=date(2026, 3, 2),
            hourly_rate=200.0,
        )
        result = await uc.execute(TENANT_ID, USER_ID, req)
        assert result.hourly_rate == 200.0
        assert result.billable_amount == 400.0

    @pytest.mark.asyncio
    async def test_response_includes_timer_fields(self, use_case):
        req = CreateTimeLogRequest(project_id=PROJECT_ID, hours=1.0, log_date=date(2026, 3, 2))
        result = await use_case.execute(TENANT_ID, USER_ID, req)
        assert result.timer_started_at is None
        assert result.timer_stopped_at is None
        assert result.is_timer_running is False


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
    async def test_updates_hourly_rate(self, use_case, seeded_uow):
        tl = TimeLog(
            tenant_id=TENANT_ID, user_id=USER_ID, project_id=PROJECT_ID,
            hours=4.0, log_date=date(2026, 3, 2), hourly_rate=50.0,
        )
        await seeded_uow.time_logs.add(tl)

        req = UpdateTimeLogRequest(hourly_rate=75.0)
        result = await use_case.execute(TENANT_ID, tl.id, req)
        assert result.hourly_rate == 75.0
        assert result.billable_amount == 300.0

    @pytest.mark.asyncio
    async def test_not_found(self, use_case):
        req = UpdateTimeLogRequest(hours=1.0)
        with pytest.raises(EntityNotFoundError):
            await use_case.execute(TENANT_ID, uuid.uuid4(), req)


class TestStartTimer:
    @pytest.fixture
    def use_case(self, seeded_uow, events: FakeEventPublisher):
        return StartTimerUseCase(seeded_uow, events)

    @pytest.mark.asyncio
    async def test_starts_timer(self, use_case, seeded_uow, events):
        req = StartTimerRequest(project_id=PROJECT_ID, log_date=date(2026, 3, 2))
        result = await use_case.execute(TENANT_ID, USER_ID, req)

        assert result.is_timer_running is True
        assert result.timer_started_at is not None
        assert result.hours == 0.0
        assert seeded_uow.committed is True

    @pytest.mark.asyncio
    async def test_publishes_timer_started_event(self, use_case, events):
        req = StartTimerRequest(project_id=PROJECT_ID, log_date=date(2026, 3, 2))
        await use_case.execute(TENANT_ID, USER_ID, req)

        assert len(events.events) == 1
        assert isinstance(events.events[0], TimerStarted)

    @pytest.mark.asyncio
    async def test_rejects_nonexistent_project(self, seeded_uow, events):
        uc = StartTimerUseCase(seeded_uow, events)
        req = StartTimerRequest(project_id=uuid.uuid4(), log_date=date(2026, 3, 2))
        with pytest.raises(EntityNotFoundError):
            await uc.execute(TENANT_ID, USER_ID, req)

    @pytest.mark.asyncio
    async def test_inherits_project_hourly_rate(self, billable_uow, events):
        uc = StartTimerUseCase(billable_uow, events)
        req = StartTimerRequest(project_id=PROJECT_ID, log_date=date(2026, 3, 2))
        result = await uc.execute(TENANT_ID, USER_ID, req)
        assert result.hourly_rate == 100.0


class TestStopTimer:
    @pytest.fixture
    def use_case(self, seeded_uow, events: FakeEventPublisher):
        return StopTimerUseCase(seeded_uow, events)

    @pytest.mark.asyncio
    async def test_stops_timer_and_calculates_hours(self, use_case, seeded_uow, events):
        # Create a time log with a timer started 2 hours ago
        started = datetime.utcnow() - timedelta(hours=2)
        tl = TimeLog(
            tenant_id=TENANT_ID, user_id=USER_ID, project_id=PROJECT_ID,
            hours=0.0, log_date=date(2026, 3, 2),
            timer_started_at=started,
        )
        await seeded_uow.time_logs.add(tl)

        result = await use_case.execute(TENANT_ID, tl.id)

        assert result.is_timer_running is False
        assert result.timer_stopped_at is not None
        assert 1.99 <= result.hours <= 2.01

    @pytest.mark.asyncio
    async def test_publishes_timer_stopped_event(self, use_case, seeded_uow, events):
        started = datetime.utcnow() - timedelta(hours=1)
        tl = TimeLog(
            tenant_id=TENANT_ID, user_id=USER_ID, project_id=PROJECT_ID,
            hours=0.0, log_date=date(2026, 3, 2),
            timer_started_at=started,
        )
        await seeded_uow.time_logs.add(tl)

        await use_case.execute(TENANT_ID, tl.id)

        assert len(events.events) == 1
        assert isinstance(events.events[0], TimerStopped)
        assert events.events[0].hours > 0

    @pytest.mark.asyncio
    async def test_not_found(self, use_case):
        with pytest.raises(EntityNotFoundError):
            await use_case.execute(TENANT_ID, uuid.uuid4())

    @pytest.mark.asyncio
    async def test_stop_calculates_billable_amount(self, seeded_uow, events):
        uc = StopTimerUseCase(seeded_uow, events)
        started = datetime.utcnow() - timedelta(hours=3)
        tl = TimeLog(
            tenant_id=TENANT_ID, user_id=USER_ID, project_id=PROJECT_ID,
            hours=0.0, log_date=date(2026, 3, 2),
            timer_started_at=started, hourly_rate=50.0,
        )
        await seeded_uow.time_logs.add(tl)

        result = await uc.execute(TENANT_ID, tl.id)
        assert result.billable_amount > 0
        assert result.hourly_rate == 50.0


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

    @pytest.mark.asyncio
    async def test_response_includes_billing_fields(self, use_case, seeded_uow):
        await seeded_uow.time_logs.add(TimeLog(
            tenant_id=TENANT_ID, user_id=USER_ID, project_id=PROJECT_ID,
            hours=8.0, log_date=date(2026, 3, 2),
            hourly_rate=100.0, billable=True,
        ))
        result = await use_case.execute(TENANT_ID, user_id=USER_ID)
        assert result[0].hourly_rate == 100.0
        assert result[0].billable_amount == 800.0
