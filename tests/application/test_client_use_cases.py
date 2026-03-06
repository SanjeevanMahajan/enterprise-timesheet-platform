import uuid

import pytest

from src.application.dto.client_dto import CreateClientRequest
from src.application.use_cases.clients.create_client import CreateClientUseCase
from src.application.use_cases.clients.get_client import GetClientUseCase
from src.application.use_cases.clients.list_clients import ListClientsUseCase
from src.domain.entities.client import Client
from src.domain.events.client_events import ClientCreated
from src.domain.exceptions import EntityNotFoundError
from tests.conftest import OTHER_TENANT_ID, TENANT_ID
from tests.fakes.services import FakeEventPublisher
from tests.fakes.unit_of_work import FakeUnitOfWork


class TestCreateClient:
    @pytest.fixture
    def use_case(self, uow: FakeUnitOfWork, events: FakeEventPublisher):
        return CreateClientUseCase(uow, events)

    @pytest.mark.asyncio
    async def test_creates_client(self, use_case, uow, events):
        req = CreateClientRequest(name="Acme Corp", contact_email="billing@acme.com")
        result = await use_case.execute(TENANT_ID, req)

        assert result.name == "Acme Corp"
        assert result.contact_email == "billing@acme.com"
        assert result.is_active is True
        assert result.tenant_id == TENANT_ID
        assert uow.committed is True

    @pytest.mark.asyncio
    async def test_publishes_client_created_event(self, use_case, events):
        req = CreateClientRequest(name="Acme Corp")
        result = await use_case.execute(TENANT_ID, req)

        assert len(events.events) == 1
        event = events.events[0]
        assert isinstance(event, ClientCreated)
        assert event.client_id == result.id
        assert event.name == "Acme Corp"

    @pytest.mark.asyncio
    async def test_creates_with_all_fields(self, use_case):
        req = CreateClientRequest(
            name="BigCo", contact_email="pm@bigco.com", contact_name="John Smith",
        )
        result = await use_case.execute(TENANT_ID, req)
        assert result.contact_name == "John Smith"


class TestGetClient:
    @pytest.fixture
    def use_case(self, uow: FakeUnitOfWork):
        return GetClientUseCase(uow)

    @pytest.mark.asyncio
    async def test_returns_existing_client(self, use_case, uow):
        c = Client(tenant_id=TENANT_ID, name="Acme")
        await uow.clients.add(c)

        result = await use_case.execute(TENANT_ID, c.id)
        assert result.name == "Acme"
        assert result.id == c.id

    @pytest.mark.asyncio
    async def test_raises_not_found(self, use_case):
        with pytest.raises(EntityNotFoundError):
            await use_case.execute(TENANT_ID, uuid.uuid4())

    @pytest.mark.asyncio
    async def test_tenant_isolation(self, use_case, uow):
        c = Client(tenant_id=OTHER_TENANT_ID, name="Other")
        await uow.clients.add(c)

        with pytest.raises(EntityNotFoundError):
            await use_case.execute(TENANT_ID, c.id)


class TestListClients:
    @pytest.fixture
    def use_case(self, uow: FakeUnitOfWork):
        return ListClientsUseCase(uow)

    @pytest.mark.asyncio
    async def test_lists_tenant_clients(self, use_case, uow):
        await uow.clients.add(Client(tenant_id=TENANT_ID, name="A"))
        await uow.clients.add(Client(tenant_id=TENANT_ID, name="B"))
        await uow.clients.add(Client(tenant_id=OTHER_TENANT_ID, name="C"))

        result = await use_case.execute(TENANT_ID)
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_pagination(self, use_case, uow):
        for i in range(5):
            await uow.clients.add(Client(tenant_id=TENANT_ID, name=f"C{i}"))

        result = await use_case.execute(TENANT_ID, offset=2, limit=2)
        assert len(result) == 2
