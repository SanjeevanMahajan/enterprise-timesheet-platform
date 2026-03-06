import uuid
from datetime import date

from src.domain.events.base import DomainEvent
from src.domain.events.client_events import ClientCreated
from src.domain.events.project_events import ProjectCreated, ProjectStatusChanged
from src.domain.events.task_events import TaskAssigned, TaskStatusChanged
from src.domain.events.timelog_events import TimeLogCreated, TimerStarted, TimerStopped
from src.domain.events.timesheet_events import (
    TimesheetApproved,
    TimesheetRejected,
    TimesheetSubmitted,
)

TENANT = uuid.UUID("00000000-0000-0000-0000-000000000001")


class TestDomainEvent:
    def test_auto_generates_event_id(self):
        e = DomainEvent(tenant_id=TENANT)
        assert e.event_id is not None

    def test_is_frozen(self):
        e = DomainEvent(tenant_id=TENANT)
        try:
            e.tenant_id = uuid.uuid4()  # type: ignore
            assert False, "Should have raised"
        except AttributeError:
            pass


class TestProjectEvents:
    def test_project_created(self):
        pid = uuid.uuid4()
        oid = uuid.uuid4()
        e = ProjectCreated(tenant_id=TENANT, project_id=pid, name="P", owner_id=oid)
        assert e.project_id == pid
        assert e.name == "P"

    def test_project_status_changed(self):
        e = ProjectStatusChanged(
            tenant_id=TENANT, project_id=uuid.uuid4(),
            old_status="active", new_status="completed",
        )
        assert e.old_status == "active"
        assert e.new_status == "completed"


class TestTaskEvents:
    def test_task_assigned(self):
        e = TaskAssigned(
            tenant_id=TENANT, task_id=uuid.uuid4(),
            assignee_id=uuid.uuid4(), project_id=uuid.uuid4(),
        )
        assert e.assignee_id is not None

    def test_task_status_changed(self):
        e = TaskStatusChanged(
            tenant_id=TENANT, task_id=uuid.uuid4(),
            old_status="todo", new_status="in_progress",
        )
        assert e.new_status == "in_progress"


class TestTimeLogEvents:
    def test_time_log_created(self):
        e = TimeLogCreated(
            tenant_id=TENANT, time_log_id=uuid.uuid4(),
            user_id=uuid.uuid4(), project_id=uuid.uuid4(),
            hours=8.0, log_date=date(2026, 3, 1),
        )
        assert e.hours == 8.0

    def test_timer_started(self):
        e = TimerStarted(
            tenant_id=TENANT, time_log_id=uuid.uuid4(),
            user_id=uuid.uuid4(), project_id=uuid.uuid4(),
        )
        assert e.time_log_id is not None

    def test_timer_stopped(self):
        e = TimerStopped(
            tenant_id=TENANT, time_log_id=uuid.uuid4(),
            user_id=uuid.uuid4(), hours=2.5,
        )
        assert e.hours == 2.5


class TestTimesheetEvents:
    def test_timesheet_submitted(self):
        e = TimesheetSubmitted(
            tenant_id=TENANT, timesheet_id=uuid.uuid4(),
            user_id=uuid.uuid4(), total_hours=40.0,
        )
        assert e.total_hours == 40.0

    def test_timesheet_approved(self):
        e = TimesheetApproved(
            tenant_id=TENANT, timesheet_id=uuid.uuid4(),
            user_id=uuid.uuid4(), approved_by=uuid.uuid4(),
        )
        assert e.approved_by is not None

    def test_timesheet_rejected(self):
        e = TimesheetRejected(
            tenant_id=TENANT, timesheet_id=uuid.uuid4(),
            user_id=uuid.uuid4(), rejected_by=uuid.uuid4(), reason="Bad",
        )
        assert e.reason == "Bad"


class TestClientEvents:
    def test_client_created(self):
        cid = uuid.uuid4()
        e = ClientCreated(tenant_id=TENANT, client_id=cid, name="Acme")
        assert e.client_id == cid
        assert e.name == "Acme"
