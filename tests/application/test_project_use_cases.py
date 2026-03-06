import uuid

import pytest

from src.application.dto.project_dto import CreateProjectRequest, UpdateProjectRequest
from src.application.use_cases.projects.create_project import CreateProjectUseCase
from src.application.use_cases.projects.delete_project import DeleteProjectUseCase
from src.application.use_cases.projects.get_project import GetProjectUseCase
from src.application.use_cases.projects.list_projects import ListProjectsUseCase
from src.application.use_cases.projects.update_project import UpdateProjectUseCase
from src.domain.entities.project import Project
from src.domain.events.project_events import ProjectCreated, ProjectStatusChanged
from src.domain.exceptions import EntityNotFoundError, InvalidStateTransitionError
from src.domain.value_objects.enums import ProjectStatus
from tests.conftest import OTHER_TENANT_ID, TENANT_ID, USER_ID
from tests.fakes.services import FakeEventPublisher
from tests.fakes.unit_of_work import FakeUnitOfWork


class TestCreateProject:
    @pytest.fixture
    def use_case(self, uow: FakeUnitOfWork, events: FakeEventPublisher):
        return CreateProjectUseCase(uow, events)

    @pytest.mark.asyncio
    async def test_creates_project(self, use_case, uow, events):
        req = CreateProjectRequest(name="MVP", description="First release")
        result = await use_case.execute(TENANT_ID, USER_ID, req)

        assert result.name == "MVP"
        assert result.description == "First release"
        assert result.owner_id == USER_ID
        assert result.status == ProjectStatus.ACTIVE
        assert result.tenant_id == TENANT_ID
        assert uow.committed is True

    @pytest.mark.asyncio
    async def test_publishes_project_created_event(self, use_case, events):
        req = CreateProjectRequest(name="MVP")
        result = await use_case.execute(TENANT_ID, USER_ID, req)

        assert len(events.events) == 1
        event = events.events[0]
        assert isinstance(event, ProjectCreated)
        assert event.project_id == result.id
        assert event.name == "MVP"
        assert event.tenant_id == TENANT_ID


class TestGetProject:
    @pytest.fixture
    def use_case(self, uow: FakeUnitOfWork):
        return GetProjectUseCase(uow)

    @pytest.mark.asyncio
    async def test_returns_existing_project(self, use_case, uow):
        p = Project(tenant_id=TENANT_ID, name="P", owner_id=USER_ID)
        await uow.projects.add(p)

        result = await use_case.execute(TENANT_ID, p.id)
        assert result.name == "P"
        assert result.id == p.id

    @pytest.mark.asyncio
    async def test_raises_not_found(self, use_case):
        fake_id = uuid.uuid4()
        with pytest.raises(EntityNotFoundError):
            await use_case.execute(TENANT_ID, fake_id)

    @pytest.mark.asyncio
    async def test_tenant_isolation(self, use_case, uow):
        p = Project(tenant_id=OTHER_TENANT_ID, name="Other", owner_id=USER_ID)
        await uow.projects.add(p)

        with pytest.raises(EntityNotFoundError):
            await use_case.execute(TENANT_ID, p.id)


class TestUpdateProject:
    @pytest.fixture
    def use_case(self, uow: FakeUnitOfWork, events: FakeEventPublisher):
        return UpdateProjectUseCase(uow, events)

    async def _seed(self, uow):
        p = Project(tenant_id=TENANT_ID, name="Old", owner_id=USER_ID)
        await uow.projects.add(p)
        return p

    @pytest.mark.asyncio
    async def test_updates_fields(self, use_case, uow):
        p = await self._seed(uow)
        req = UpdateProjectRequest(name="New", description="Updated")
        result = await use_case.execute(TENANT_ID, p.id, req)
        assert result.name == "New"
        assert result.description == "Updated"

    @pytest.mark.asyncio
    async def test_status_transition(self, use_case, uow, events):
        p = await self._seed(uow)
        req = UpdateProjectRequest(status=ProjectStatus.ON_HOLD)
        result = await use_case.execute(TENANT_ID, p.id, req)

        assert result.status == ProjectStatus.ON_HOLD
        assert len(events.events) == 1
        assert isinstance(events.events[0], ProjectStatusChanged)

    @pytest.mark.asyncio
    async def test_invalid_transition_raises(self, use_case, uow):
        p = Project(tenant_id=TENANT_ID, name="P", owner_id=USER_ID, status=ProjectStatus.ARCHIVED)
        await uow.projects.add(p)

        req = UpdateProjectRequest(status=ProjectStatus.ACTIVE)
        with pytest.raises(InvalidStateTransitionError):
            await use_case.execute(TENANT_ID, p.id, req)

    @pytest.mark.asyncio
    async def test_not_found(self, use_case):
        req = UpdateProjectRequest(name="X")
        with pytest.raises(EntityNotFoundError):
            await use_case.execute(TENANT_ID, uuid.uuid4(), req)

    @pytest.mark.asyncio
    async def test_no_event_when_status_unchanged(self, use_case, uow, events):
        p = await self._seed(uow)
        req = UpdateProjectRequest(name="Renamed")
        await use_case.execute(TENANT_ID, p.id, req)
        assert len(events.events) == 0


class TestListProjects:
    @pytest.fixture
    def use_case(self, uow: FakeUnitOfWork):
        return ListProjectsUseCase(uow)

    @pytest.mark.asyncio
    async def test_lists_tenant_projects(self, use_case, uow):
        await uow.projects.add(Project(tenant_id=TENANT_ID, name="A", owner_id=USER_ID))
        await uow.projects.add(Project(tenant_id=TENANT_ID, name="B", owner_id=USER_ID))
        await uow.projects.add(Project(tenant_id=OTHER_TENANT_ID, name="C", owner_id=USER_ID))

        result = await use_case.execute(TENANT_ID)
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_pagination(self, use_case, uow):
        for i in range(5):
            await uow.projects.add(Project(tenant_id=TENANT_ID, name=f"P{i}", owner_id=USER_ID))

        result = await use_case.execute(TENANT_ID, offset=2, limit=2)
        assert len(result) == 2


class TestDeleteProject:
    @pytest.fixture
    def use_case(self, uow: FakeUnitOfWork):
        return DeleteProjectUseCase(uow)

    @pytest.mark.asyncio
    async def test_deletes_project(self, use_case, uow):
        p = Project(tenant_id=TENANT_ID, name="P", owner_id=USER_ID)
        await uow.projects.add(p)

        await use_case.execute(TENANT_ID, p.id)
        assert await uow.projects.get_by_id(TENANT_ID, p.id) is None
        assert uow.committed is True

    @pytest.mark.asyncio
    async def test_not_found(self, use_case):
        with pytest.raises(EntityNotFoundError):
            await use_case.execute(TENANT_ID, uuid.uuid4())
