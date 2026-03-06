import uuid

import pytest

from src.application.dto.user_dto import AuthRequest, CreateUserRequest
from src.application.use_cases.users.authenticate_user import AuthenticateUserUseCase
from src.application.use_cases.users.register_user import RegisterUserUseCase
from src.domain.entities.user import User
from src.domain.exceptions import AuthorizationError, DuplicateEntityError
from src.domain.value_objects.enums import Role
from tests.conftest import TENANT_ID
from tests.fakes.services import FakeEventPublisher, FakePasswordHasher, FakeTokenService
from tests.fakes.unit_of_work import FakeUnitOfWork


class TestRegisterUser:
    @pytest.fixture
    def use_case(self, uow: FakeUnitOfWork, hasher: FakePasswordHasher, events: FakeEventPublisher):
        return RegisterUserUseCase(uow, hasher, events)

    @pytest.mark.asyncio
    async def test_registers_new_user(self, use_case, uow):
        req = CreateUserRequest(email="a@b.com", full_name="A B", password="pass123")
        result = await use_case.execute(TENANT_ID, req)

        assert result.email == "a@b.com"
        assert result.full_name == "A B"
        assert result.role == Role.MEMBER
        assert result.is_active is True
        assert result.tenant_id == TENANT_ID
        assert uow.committed is True

    @pytest.mark.asyncio
    async def test_hashes_password(self, use_case, uow):
        req = CreateUserRequest(email="a@b.com", full_name="A B", password="secret")
        await use_case.execute(TENANT_ID, req)

        stored = (await uow.users.list(TENANT_ID))[0]
        assert stored.hashed_password == "hashed_secret"

    @pytest.mark.asyncio
    async def test_rejects_duplicate_email(self, use_case, uow):
        existing = User(
            tenant_id=TENANT_ID, email="a@b.com", full_name="Existing",
            hashed_password="h",
        )
        await uow.users.add(existing)

        req = CreateUserRequest(email="a@b.com", full_name="New", password="pass")
        with pytest.raises(DuplicateEntityError):
            await use_case.execute(TENANT_ID, req)

    @pytest.mark.asyncio
    async def test_register_with_admin_role(self, use_case):
        req = CreateUserRequest(email="admin@b.com", full_name="Admin", password="pass", role=Role.ADMIN)
        result = await use_case.execute(TENANT_ID, req)
        assert result.role == Role.ADMIN


class TestAuthenticateUser:
    @pytest.fixture
    def use_case(self, uow: FakeUnitOfWork, hasher: FakePasswordHasher, tokens: FakeTokenService):
        return AuthenticateUserUseCase(uow, hasher, tokens)

    async def _seed_user(self, uow: FakeUnitOfWork, email="a@b.com", password="pass", is_active=True):
        user = User(
            tenant_id=TENANT_ID, email=email, full_name="Test",
            hashed_password=f"hashed_{password}", role=Role.MEMBER, is_active=is_active,
        )
        await uow.users.add(user)
        return user

    @pytest.mark.asyncio
    async def test_returns_tokens_on_valid_credentials(self, use_case, uow):
        user = await self._seed_user(uow)
        req = AuthRequest(email="a@b.com", password="pass")
        result = await use_case.execute(TENANT_ID, req)

        assert result.access_token == f"access_{user.id}_member"
        assert result.refresh_token == f"refresh_{user.id}"
        assert result.token_type == "bearer"

    @pytest.mark.asyncio
    async def test_rejects_wrong_password(self, use_case, uow):
        await self._seed_user(uow)
        req = AuthRequest(email="a@b.com", password="wrong")
        with pytest.raises(AuthorizationError):
            await use_case.execute(TENANT_ID, req)

    @pytest.mark.asyncio
    async def test_rejects_nonexistent_email(self, use_case, uow):
        req = AuthRequest(email="nobody@b.com", password="pass")
        with pytest.raises(AuthorizationError):
            await use_case.execute(TENANT_ID, req)

    @pytest.mark.asyncio
    async def test_rejects_inactive_user(self, use_case, uow):
        await self._seed_user(uow, is_active=False)
        req = AuthRequest(email="a@b.com", password="pass")
        with pytest.raises(AuthorizationError):
            await use_case.execute(TENANT_ID, req)
