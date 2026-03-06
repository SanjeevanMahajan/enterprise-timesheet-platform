import uuid

import pytest

from src.application.dto.task_dto import AssignTaskRequest, CreateTaskRequest, UpdateTaskRequest
from src.application.use_cases.tasks.assign_task import AssignTaskUseCase
from src.application.use_cases.tasks.create_task import CreateTaskUseCase
from src.application.use_cases.tasks.get_task import GetTaskUseCase
from src.application.use_cases.tasks.list_tasks import ListTasksUseCase
from src.application.use_cases.tasks.update_task import UpdateTaskUseCase
from src.domain.entities.project import Project
from src.domain.entities.task import Task
from src.domain.events.task_events import TaskAssigned, TaskStatusChanged
from src.domain.exceptions import EntityNotFoundError
from src.domain.value_objects.enums import TaskPriority, TaskStatus
from tests.conftest import TENANT_ID, USER_ID
from tests.fakes.services import FakeEventPublisher
from tests.fakes.unit_of_work import FakeUnitOfWork


@pytest.fixture
async def seeded_uow(uow: FakeUnitOfWork):
    """UoW with a project already in place."""
    await uow.projects.add(Project(
        tenant_id=TENANT_ID, name="P", owner_id=USER_ID,
        id=uuid.UUID("00000000-0000-0000-0000-000000000100"),
    ))
    return uow


PROJECT_ID = uuid.UUID("00000000-0000-0000-0000-000000000100")


class TestCreateTask:
    @pytest.fixture
    def use_case(self, seeded_uow, events: FakeEventPublisher):
        return CreateTaskUseCase(seeded_uow, events)

    @pytest.mark.asyncio
    async def test_creates_task(self, use_case, seeded_uow):
        req = CreateTaskRequest(project_id=PROJECT_ID, title="Build API")
        result = await use_case.execute(TENANT_ID, req)

        assert result.title == "Build API"
        assert result.project_id == PROJECT_ID
        assert result.status == TaskStatus.TODO
        assert seeded_uow.committed is True

    @pytest.mark.asyncio
    async def test_publishes_event_when_assigned(self, use_case, events):
        assignee = uuid.uuid4()
        req = CreateTaskRequest(project_id=PROJECT_ID, title="T", assignee_id=assignee)
        await use_case.execute(TENANT_ID, req)

        assert len(events.events) == 1
        assert isinstance(events.events[0], TaskAssigned)
        assert events.events[0].assignee_id == assignee

    @pytest.mark.asyncio
    async def test_no_event_when_unassigned(self, use_case, events):
        req = CreateTaskRequest(project_id=PROJECT_ID, title="T")
        await use_case.execute(TENANT_ID, req)
        assert len(events.events) == 0

    @pytest.mark.asyncio
    async def test_rejects_nonexistent_project(self, seeded_uow, events):
        uc = CreateTaskUseCase(seeded_uow, events)
        req = CreateTaskRequest(project_id=uuid.uuid4(), title="T")
        with pytest.raises(EntityNotFoundError):
            await uc.execute(TENANT_ID, req)


class TestGetTask:
    @pytest.fixture
    def use_case(self, seeded_uow):
        return GetTaskUseCase(seeded_uow)

    @pytest.mark.asyncio
    async def test_returns_task(self, use_case, seeded_uow):
        t = Task(tenant_id=TENANT_ID, project_id=PROJECT_ID, title="T")
        await seeded_uow.tasks.add(t)
        result = await use_case.execute(TENANT_ID, t.id)
        assert result.title == "T"

    @pytest.mark.asyncio
    async def test_not_found(self, use_case):
        with pytest.raises(EntityNotFoundError):
            await use_case.execute(TENANT_ID, uuid.uuid4())


class TestUpdateTask:
    @pytest.fixture
    def use_case(self, seeded_uow, events):
        return UpdateTaskUseCase(seeded_uow, events)

    @pytest.mark.asyncio
    async def test_updates_fields(self, use_case, seeded_uow):
        t = Task(tenant_id=TENANT_ID, project_id=PROJECT_ID, title="Old")
        await seeded_uow.tasks.add(t)

        req = UpdateTaskRequest(title="New", priority=TaskPriority.HIGH)
        result = await use_case.execute(TENANT_ID, t.id, req)
        assert result.title == "New"
        assert result.priority == TaskPriority.HIGH

    @pytest.mark.asyncio
    async def test_status_change_publishes_event(self, use_case, seeded_uow, events):
        t = Task(tenant_id=TENANT_ID, project_id=PROJECT_ID, title="T")
        await seeded_uow.tasks.add(t)

        req = UpdateTaskRequest(status=TaskStatus.IN_PROGRESS)
        await use_case.execute(TENANT_ID, t.id, req)

        assert len(events.events) == 1
        assert isinstance(events.events[0], TaskStatusChanged)


class TestAssignTask:
    @pytest.fixture
    def use_case(self, seeded_uow, events):
        return AssignTaskUseCase(seeded_uow, events)

    @pytest.mark.asyncio
    async def test_assigns_user(self, use_case, seeded_uow, events):
        t = Task(tenant_id=TENANT_ID, project_id=PROJECT_ID, title="T")
        await seeded_uow.tasks.add(t)
        assignee = uuid.uuid4()

        req = AssignTaskRequest(assignee_id=assignee)
        result = await use_case.execute(TENANT_ID, t.id, req)

        assert result.assignee_id == assignee
        assert len(events.events) == 1
        assert isinstance(events.events[0], TaskAssigned)

    @pytest.mark.asyncio
    async def test_not_found(self, use_case, events):
        req = AssignTaskRequest(assignee_id=uuid.uuid4())
        with pytest.raises(EntityNotFoundError):
            await use_case.execute(TENANT_ID, uuid.uuid4(), req)


class TestListTasks:
    @pytest.fixture
    def use_case(self, seeded_uow):
        return ListTasksUseCase(seeded_uow)

    @pytest.mark.asyncio
    async def test_list_all(self, use_case, seeded_uow):
        await seeded_uow.tasks.add(Task(tenant_id=TENANT_ID, project_id=PROJECT_ID, title="A"))
        await seeded_uow.tasks.add(Task(tenant_id=TENANT_ID, project_id=PROJECT_ID, title="B"))

        result = await use_case.execute(TENANT_ID)
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_filter_by_project(self, use_case, seeded_uow):
        other_project = uuid.uuid4()
        await seeded_uow.tasks.add(Task(tenant_id=TENANT_ID, project_id=PROJECT_ID, title="A"))
        await seeded_uow.tasks.add(Task(tenant_id=TENANT_ID, project_id=other_project, title="B"))

        result = await use_case.execute(TENANT_ID, project_id=PROJECT_ID)
        assert len(result) == 1
        assert result[0].title == "A"

    @pytest.mark.asyncio
    async def test_filter_by_assignee(self, use_case, seeded_uow):
        assignee = uuid.uuid4()
        await seeded_uow.tasks.add(Task(tenant_id=TENANT_ID, project_id=PROJECT_ID, title="A", assignee_id=assignee))
        await seeded_uow.tasks.add(Task(tenant_id=TENANT_ID, project_id=PROJECT_ID, title="B"))

        result = await use_case.execute(TENANT_ID, assignee_id=assignee)
        assert len(result) == 1
        assert result[0].title == "A"
