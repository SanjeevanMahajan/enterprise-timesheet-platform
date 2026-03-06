import uuid
from datetime import date

import pytest

from src.domain.entities.base import Entity
from src.domain.entities.issue import Issue
from src.domain.entities.notification import Notification
from src.domain.entities.organization import Organization
from src.domain.entities.phase import Phase
from src.domain.entities.project import Project
from src.domain.entities.task import Task
from src.domain.entities.time_log import TimeLog
from src.domain.entities.timesheet import Timesheet
from src.domain.entities.user import User
from src.domain.exceptions import (
    BusinessRuleViolationError,
    InvalidStateTransitionError,
)
from src.domain.value_objects.enums import (
    IssuePriority,
    IssueStatus,
    NotificationChannel,
    ProjectStatus,
    Role,
    TaskPriority,
    TaskStatus,
    TimesheetStatus,
)

TENANT = uuid.UUID("00000000-0000-0000-0000-000000000001")


# ── Base Entity ──────────────────────────────────────────────────────────────

class TestBaseEntity:
    def test_auto_generates_id(self):
        e = Entity(tenant_id=TENANT)
        assert e.id is not None
        assert isinstance(e.id, uuid.UUID)

    def test_accepts_explicit_id(self):
        eid = uuid.uuid4()
        e = Entity(id=eid, tenant_id=TENANT)
        assert e.id == eid

    def test_touch_updates_timestamp(self):
        e = Entity(tenant_id=TENANT)
        old = e.updated_at
        e.touch()
        assert e.updated_at >= old

    def test_equality_by_id(self):
        eid = uuid.uuid4()
        e1 = Entity(id=eid, tenant_id=TENANT)
        e2 = Entity(id=eid, tenant_id=TENANT)
        assert e1 == e2

    def test_inequality_different_ids(self):
        e1 = Entity(tenant_id=TENANT)
        e2 = Entity(tenant_id=TENANT)
        assert e1 != e2

    def test_hash_by_id(self):
        eid = uuid.uuid4()
        e1 = Entity(id=eid, tenant_id=TENANT)
        e2 = Entity(id=eid, tenant_id=TENANT)
        assert hash(e1) == hash(e2)
        assert len({e1, e2}) == 1

    def test_not_equal_to_non_entity(self):
        e = Entity(tenant_id=TENANT)
        assert e != "not an entity"


# ── User ─────────────────────────────────────────────────────────────────────

class TestUser:
    def test_create_with_defaults(self):
        u = User(tenant_id=TENANT, email="a@b.com", full_name="A B", hashed_password="h")
        assert u.role == Role.MEMBER
        assert u.is_active is True

    def test_deactivate(self):
        u = User(tenant_id=TENANT, email="a@b.com", full_name="A B", hashed_password="h")
        u.deactivate()
        assert u.is_active is False

    def test_change_role(self):
        u = User(tenant_id=TENANT, email="a@b.com", full_name="A B", hashed_password="h")
        u.change_role(Role.ADMIN)
        assert u.role == Role.ADMIN

    def test_has_permission_admin_can_do_anything(self):
        u = User(tenant_id=TENANT, email="a@b.com", full_name="A", hashed_password="h", role=Role.ADMIN)
        assert u.has_permission(Role.ADMIN) is True
        assert u.has_permission(Role.MANAGER) is True
        assert u.has_permission(Role.MEMBER) is True
        assert u.has_permission(Role.VIEWER) is True

    def test_has_permission_viewer_limited(self):
        u = User(tenant_id=TENANT, email="a@b.com", full_name="A", hashed_password="h", role=Role.VIEWER)
        assert u.has_permission(Role.VIEWER) is True
        assert u.has_permission(Role.MEMBER) is False
        assert u.has_permission(Role.MANAGER) is False
        assert u.has_permission(Role.ADMIN) is False

    def test_has_permission_member_hierarchy(self):
        u = User(tenant_id=TENANT, email="a@b.com", full_name="A", hashed_password="h", role=Role.MEMBER)
        assert u.has_permission(Role.MEMBER) is True
        assert u.has_permission(Role.VIEWER) is True
        assert u.has_permission(Role.MANAGER) is False


# ── Project ──────────────────────────────────────────────────────────────────

class TestProject:
    def test_create_defaults_to_active(self):
        p = Project(tenant_id=TENANT, name="P", owner_id=uuid.uuid4())
        assert p.status == ProjectStatus.ACTIVE

    def test_valid_transitions_from_active(self):
        for target in [ProjectStatus.ON_HOLD, ProjectStatus.COMPLETED, ProjectStatus.ARCHIVED]:
            p = Project(tenant_id=TENANT, name="P", owner_id=uuid.uuid4())
            p.transition_to(target)
            assert p.status == target

    def test_invalid_transition_active_to_active(self):
        p = Project(tenant_id=TENANT, name="P", owner_id=uuid.uuid4())
        with pytest.raises(InvalidStateTransitionError):
            p.transition_to(ProjectStatus.ACTIVE)

    def test_archived_cannot_transition(self):
        p = Project(tenant_id=TENANT, name="P", owner_id=uuid.uuid4(), status=ProjectStatus.ARCHIVED)
        with pytest.raises(InvalidStateTransitionError):
            p.transition_to(ProjectStatus.ACTIVE)

    def test_completed_can_archive(self):
        p = Project(tenant_id=TENANT, name="P", owner_id=uuid.uuid4(), status=ProjectStatus.COMPLETED)
        p.transition_to(ProjectStatus.ARCHIVED)
        assert p.status == ProjectStatus.ARCHIVED

    def test_completed_cannot_go_active(self):
        p = Project(tenant_id=TENANT, name="P", owner_id=uuid.uuid4(), status=ProjectStatus.COMPLETED)
        with pytest.raises(InvalidStateTransitionError):
            p.transition_to(ProjectStatus.ACTIVE)

    def test_on_hold_can_resume(self):
        p = Project(tenant_id=TENANT, name="P", owner_id=uuid.uuid4(), status=ProjectStatus.ON_HOLD)
        p.transition_to(ProjectStatus.ACTIVE)
        assert p.status == ProjectStatus.ACTIVE

    def test_transition_updates_timestamp(self):
        p = Project(tenant_id=TENANT, name="P", owner_id=uuid.uuid4())
        old = p.updated_at
        p.transition_to(ProjectStatus.ON_HOLD)
        assert p.updated_at >= old


# ── Task ─────────────────────────────────────────────────────────────────────

class TestTask:
    def test_create_defaults(self):
        t = Task(tenant_id=TENANT, project_id=uuid.uuid4(), title="T")
        assert t.status == TaskStatus.TODO
        assert t.priority == TaskPriority.MEDIUM
        assert t.assignee_id is None

    def test_valid_transitions(self):
        t = Task(tenant_id=TENANT, project_id=uuid.uuid4(), title="T")
        t.transition_to(TaskStatus.IN_PROGRESS)
        assert t.status == TaskStatus.IN_PROGRESS
        t.transition_to(TaskStatus.REVIEW)
        assert t.status == TaskStatus.REVIEW
        t.transition_to(TaskStatus.DONE)
        assert t.status == TaskStatus.DONE

    def test_cannot_skip_to_done(self):
        t = Task(tenant_id=TENANT, project_id=uuid.uuid4(), title="T")
        with pytest.raises(InvalidStateTransitionError):
            t.transition_to(TaskStatus.DONE)

    def test_done_can_reopen(self):
        t = Task(tenant_id=TENANT, project_id=uuid.uuid4(), title="T", status=TaskStatus.DONE)
        t.transition_to(TaskStatus.TODO)
        assert t.status == TaskStatus.TODO

    def test_review_can_go_back_to_in_progress(self):
        t = Task(tenant_id=TENANT, project_id=uuid.uuid4(), title="T", status=TaskStatus.REVIEW)
        t.transition_to(TaskStatus.IN_PROGRESS)
        assert t.status == TaskStatus.IN_PROGRESS

    def test_assign_to(self):
        t = Task(tenant_id=TENANT, project_id=uuid.uuid4(), title="T")
        uid = uuid.uuid4()
        t.assign_to(uid)
        assert t.assignee_id == uid

    def test_unassign(self):
        uid = uuid.uuid4()
        t = Task(tenant_id=TENANT, project_id=uuid.uuid4(), title="T", assignee_id=uid)
        t.unassign()
        assert t.assignee_id is None


# ── TimeLog ──────────────────────────────────────────────────────────────────

class TestTimeLog:
    def test_create_valid(self):
        tl = TimeLog(
            tenant_id=TENANT, user_id=uuid.uuid4(), project_id=uuid.uuid4(),
            hours=8.0, log_date=date(2026, 3, 1),
        )
        assert tl.hours == 8.0
        assert tl.billable is True

    def test_zero_hours_rejected(self):
        with pytest.raises(BusinessRuleViolationError):
            TimeLog(
                tenant_id=TENANT, user_id=uuid.uuid4(), project_id=uuid.uuid4(),
                hours=0, log_date=date(2026, 3, 1),
            )

    def test_negative_hours_rejected(self):
        with pytest.raises(BusinessRuleViolationError):
            TimeLog(
                tenant_id=TENANT, user_id=uuid.uuid4(), project_id=uuid.uuid4(),
                hours=-1.0, log_date=date(2026, 3, 1),
            )

    def test_exceeds_24_hours_rejected(self):
        with pytest.raises(BusinessRuleViolationError):
            TimeLog(
                tenant_id=TENANT, user_id=uuid.uuid4(), project_id=uuid.uuid4(),
                hours=25.0, log_date=date(2026, 3, 1),
            )

    def test_exactly_24_hours_allowed(self):
        tl = TimeLog(
            tenant_id=TENANT, user_id=uuid.uuid4(), project_id=uuid.uuid4(),
            hours=24.0, log_date=date(2026, 3, 1),
        )
        assert tl.hours == 24.0

    def test_update_hours_valid(self):
        tl = TimeLog(
            tenant_id=TENANT, user_id=uuid.uuid4(), project_id=uuid.uuid4(),
            hours=4.0, log_date=date(2026, 3, 1),
        )
        tl.update_hours(6.0)
        assert tl.hours == 6.0

    def test_update_hours_invalid(self):
        tl = TimeLog(
            tenant_id=TENANT, user_id=uuid.uuid4(), project_id=uuid.uuid4(),
            hours=4.0, log_date=date(2026, 3, 1),
        )
        with pytest.raises(BusinessRuleViolationError):
            tl.update_hours(0)


# ── Timesheet ────────────────────────────────────────────────────────────────

class TestTimesheet:
    def _make(self, status: TimesheetStatus = TimesheetStatus.DRAFT) -> Timesheet:
        return Timesheet(
            tenant_id=TENANT, user_id=uuid.uuid4(),
            week_start=date(2026, 3, 2), week_end=date(2026, 3, 8),
            status=status,
        )

    def test_create_defaults_to_draft(self):
        ts = self._make()
        assert ts.status == TimesheetStatus.DRAFT

    def test_submit(self):
        ts = self._make()
        ts.submit()
        assert ts.status == TimesheetStatus.SUBMITTED

    def test_approve(self):
        ts = self._make(TimesheetStatus.SUBMITTED)
        approver = uuid.uuid4()
        ts.approve(approver)
        assert ts.status == TimesheetStatus.APPROVED
        assert ts.approved_by == approver

    def test_reject(self):
        ts = self._make(TimesheetStatus.SUBMITTED)
        approver = uuid.uuid4()
        ts.reject(approver, "Missing entries")
        assert ts.status == TimesheetStatus.REJECTED
        assert ts.rejection_reason == "Missing entries"
        assert ts.approved_by == approver

    def test_reopen_after_rejection(self):
        ts = self._make(TimesheetStatus.REJECTED)
        ts.reopen()
        assert ts.status == TimesheetStatus.DRAFT
        assert ts.approved_by is None
        assert ts.rejection_reason == ""

    def test_cannot_submit_already_submitted(self):
        ts = self._make(TimesheetStatus.SUBMITTED)
        with pytest.raises(InvalidStateTransitionError):
            ts.submit()

    def test_cannot_approve_draft(self):
        ts = self._make(TimesheetStatus.DRAFT)
        with pytest.raises(InvalidStateTransitionError):
            ts.approve(uuid.uuid4())

    def test_approved_is_final(self):
        ts = self._make(TimesheetStatus.APPROVED)
        with pytest.raises(InvalidStateTransitionError):
            ts.submit()
        with pytest.raises(InvalidStateTransitionError):
            ts.reject(uuid.uuid4(), "no")

    def test_full_lifecycle(self):
        ts = self._make()
        ts.submit()
        ts.reject(uuid.uuid4(), "Fix hours")
        ts.reopen()
        ts.submit()
        ts.approve(uuid.uuid4())
        assert ts.status == TimesheetStatus.APPROVED


# ── Organization ─────────────────────────────────────────────────────────────

class TestOrganization:
    def test_create(self):
        o = Organization(tenant_id=TENANT, name="Acme", slug="acme", owner_id=uuid.uuid4())
        assert o.is_active is True

    def test_deactivate(self):
        o = Organization(tenant_id=TENANT, name="Acme", slug="acme", owner_id=uuid.uuid4())
        o.deactivate()
        assert o.is_active is False


# ── Phase ────────────────────────────────────────────────────────────────────

class TestPhase:
    def test_create(self):
        p = Phase(tenant_id=TENANT, project_id=uuid.uuid4(), name="Design")
        assert p.sort_order == 0


# ── Issue ────────────────────────────────────────────────────────────────────

class TestIssue:
    def test_create_defaults(self):
        i = Issue(
            tenant_id=TENANT, project_id=uuid.uuid4(),
            title="Bug", reported_by=uuid.uuid4(),
        )
        assert i.status == IssueStatus.OPEN
        assert i.priority == IssuePriority.MEDIUM
        assert i.assignee_id is None


# ── Notification ─────────────────────────────────────────────────────────────

class TestNotification:
    def test_create_unread(self):
        n = Notification(
            tenant_id=TENANT, recipient_id=uuid.uuid4(),
            channel=NotificationChannel.EMAIL, title="Hi", body="Hello",
        )
        assert n.is_read is False

    def test_mark_read(self):
        n = Notification(
            tenant_id=TENANT, recipient_id=uuid.uuid4(),
            channel=NotificationChannel.IN_APP, title="Hi", body="Hello",
        )
        n.mark_read()
        assert n.is_read is True
