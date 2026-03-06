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


class TestRole:
    def test_values(self):
        assert set(Role) == {"admin", "manager", "member", "viewer"}

    def test_string_representation(self):
        assert str(Role.ADMIN) == "admin"


class TestProjectStatus:
    def test_values(self):
        assert set(ProjectStatus) == {"active", "on_hold", "completed", "archived"}


class TestTaskStatus:
    def test_values(self):
        assert set(TaskStatus) == {"todo", "in_progress", "review", "done"}


class TestTaskPriority:
    def test_values(self):
        assert set(TaskPriority) == {"low", "medium", "high", "critical"}


class TestTimesheetStatus:
    def test_values(self):
        assert set(TimesheetStatus) == {"draft", "submitted", "approved", "rejected"}


class TestIssueStatus:
    def test_values(self):
        assert set(IssueStatus) == {"open", "in_progress", "resolved", "closed"}


class TestIssuePriority:
    def test_values(self):
        assert set(IssuePriority) == {"low", "medium", "high", "critical"}


class TestNotificationChannel:
    def test_values(self):
        assert set(NotificationChannel) == {"email", "slack", "google_chat", "in_app"}
