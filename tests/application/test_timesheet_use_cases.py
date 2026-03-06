import uuid
from datetime import date

import pytest

from src.application.dto.timesheet_dto import CreateTimesheetRequest, RejectTimesheetRequest
from src.application.use_cases.timesheets.approve_timesheet import ApproveTimesheetUseCase
from src.application.use_cases.timesheets.get_timesheet import GetTimesheetUseCase
from src.application.use_cases.timesheets.reject_timesheet import RejectTimesheetUseCase
from src.application.use_cases.timesheets.submit_timesheet import SubmitTimesheetUseCase
from src.domain.entities.time_log import TimeLog
from src.domain.entities.timesheet import Timesheet
from src.domain.events.timesheet_events import (
    TimesheetApproved,
    TimesheetRejected,
    TimesheetSubmitted,
)
from src.domain.exceptions import EntityNotFoundError, InvalidStateTransitionError
from src.domain.value_objects.enums import TimesheetStatus
from tests.conftest import TENANT_ID, USER_ID
from tests.fakes.services import FakeEventPublisher
from tests.fakes.unit_of_work import FakeUnitOfWork

WEEK_START = date(2026, 3, 2)
WEEK_END = date(2026, 3, 8)
PROJECT_ID = uuid.UUID("00000000-0000-0000-0000-000000000100")
APPROVER_ID = uuid.UUID("00000000-0000-0000-0000-000000000020")


class TestSubmitTimesheet:
    @pytest.fixture
    def use_case(self, uow: FakeUnitOfWork, events: FakeEventPublisher):
        return SubmitTimesheetUseCase(uow, events)

    @pytest.mark.asyncio
    async def test_submits_new_timesheet(self, use_case, uow, events):
        # Seed time logs for the week
        await uow.time_logs.add(TimeLog(
            tenant_id=TENANT_ID, user_id=USER_ID, project_id=PROJECT_ID,
            hours=8.0, log_date=date(2026, 3, 3),
        ))
        await uow.time_logs.add(TimeLog(
            tenant_id=TENANT_ID, user_id=USER_ID, project_id=PROJECT_ID,
            hours=8.0, log_date=date(2026, 3, 4),
        ))

        req = CreateTimesheetRequest(week_start=WEEK_START, week_end=WEEK_END)
        result = await use_case.execute(TENANT_ID, USER_ID, req)

        assert result.status == TimesheetStatus.SUBMITTED
        assert result.total_hours == 16.0
        assert result.user_id == USER_ID
        assert uow.committed is True

    @pytest.mark.asyncio
    async def test_publishes_submitted_event(self, use_case, uow, events):
        req = CreateTimesheetRequest(week_start=WEEK_START, week_end=WEEK_END)
        await use_case.execute(TENANT_ID, USER_ID, req)

        assert len(events.events) == 1
        assert isinstance(events.events[0], TimesheetSubmitted)

    @pytest.mark.asyncio
    async def test_resubmit_after_rejection(self, use_case, uow):
        # Pre-seed a rejected timesheet
        ts = Timesheet(
            tenant_id=TENANT_ID, user_id=USER_ID,
            week_start=WEEK_START, week_end=WEEK_END,
            status=TimesheetStatus.REJECTED,
        )
        await uow.timesheets.add(ts)

        req = CreateTimesheetRequest(week_start=WEEK_START, week_end=WEEK_END)
        result = await use_case.execute(TENANT_ID, USER_ID, req)
        assert result.status == TimesheetStatus.SUBMITTED


class TestApproveTimesheet:
    @pytest.fixture
    def use_case(self, uow: FakeUnitOfWork, events: FakeEventPublisher):
        return ApproveTimesheetUseCase(uow, events)

    @pytest.mark.asyncio
    async def test_approves_submitted_timesheet(self, use_case, uow, events):
        ts = Timesheet(
            tenant_id=TENANT_ID, user_id=USER_ID,
            week_start=WEEK_START, week_end=WEEK_END,
            status=TimesheetStatus.SUBMITTED,
        )
        await uow.timesheets.add(ts)

        result = await use_case.execute(TENANT_ID, ts.id, APPROVER_ID)
        assert result.status == TimesheetStatus.APPROVED
        assert result.approved_by == APPROVER_ID

        assert len(events.events) == 1
        assert isinstance(events.events[0], TimesheetApproved)

    @pytest.mark.asyncio
    async def test_cannot_approve_draft(self, use_case, uow):
        ts = Timesheet(
            tenant_id=TENANT_ID, user_id=USER_ID,
            week_start=WEEK_START, week_end=WEEK_END,
            status=TimesheetStatus.DRAFT,
        )
        await uow.timesheets.add(ts)

        with pytest.raises(InvalidStateTransitionError):
            await use_case.execute(TENANT_ID, ts.id, APPROVER_ID)

    @pytest.mark.asyncio
    async def test_not_found(self, use_case):
        with pytest.raises(EntityNotFoundError):
            await use_case.execute(TENANT_ID, uuid.uuid4(), APPROVER_ID)


class TestRejectTimesheet:
    @pytest.fixture
    def use_case(self, uow: FakeUnitOfWork, events: FakeEventPublisher):
        return RejectTimesheetUseCase(uow, events)

    @pytest.mark.asyncio
    async def test_rejects_with_reason(self, use_case, uow, events):
        ts = Timesheet(
            tenant_id=TENANT_ID, user_id=USER_ID,
            week_start=WEEK_START, week_end=WEEK_END,
            status=TimesheetStatus.SUBMITTED,
        )
        await uow.timesheets.add(ts)

        req = RejectTimesheetRequest(reason="Missing Friday hours")
        result = await use_case.execute(TENANT_ID, ts.id, APPROVER_ID, req)

        assert result.status == TimesheetStatus.REJECTED
        assert result.rejection_reason == "Missing Friday hours"
        assert isinstance(events.events[0], TimesheetRejected)

    @pytest.mark.asyncio
    async def test_not_found(self, use_case):
        req = RejectTimesheetRequest(reason="x")
        with pytest.raises(EntityNotFoundError):
            await use_case.execute(TENANT_ID, uuid.uuid4(), APPROVER_ID, req)


class TestGetTimesheet:
    @pytest.fixture
    def use_case(self, uow: FakeUnitOfWork):
        return GetTimesheetUseCase(uow)

    @pytest.mark.asyncio
    async def test_returns_timesheet(self, use_case, uow):
        ts = Timesheet(
            tenant_id=TENANT_ID, user_id=USER_ID,
            week_start=WEEK_START, week_end=WEEK_END,
        )
        await uow.timesheets.add(ts)

        result = await use_case.execute(TENANT_ID, ts.id)
        assert result.id == ts.id
        assert result.week_start == WEEK_START

    @pytest.mark.asyncio
    async def test_not_found(self, use_case):
        with pytest.raises(EntityNotFoundError):
            await use_case.execute(TENANT_ID, uuid.uuid4())
