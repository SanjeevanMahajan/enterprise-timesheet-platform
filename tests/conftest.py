import uuid

import pytest

from tests.fakes.services import FakeEventPublisher, FakePasswordHasher, FakeTokenService
from tests.fakes.unit_of_work import FakeUnitOfWork

TENANT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
OTHER_TENANT_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")


@pytest.fixture
def uow() -> FakeUnitOfWork:
    return FakeUnitOfWork()


@pytest.fixture
def events() -> FakeEventPublisher:
    return FakeEventPublisher()


@pytest.fixture
def hasher() -> FakePasswordHasher:
    return FakePasswordHasher()


@pytest.fixture
def tokens() -> FakeTokenService:
    return FakeTokenService()
