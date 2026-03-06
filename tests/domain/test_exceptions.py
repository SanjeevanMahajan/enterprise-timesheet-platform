import uuid

from src.domain.exceptions import (
    AuthorizationError,
    BusinessRuleViolationError,
    DomainError,
    DuplicateEntityError,
    EntityNotFoundError,
    InvalidStateTransitionError,
    TenantMismatchError,
)


class TestExceptions:
    def test_entity_not_found(self):
        eid = uuid.uuid4()
        e = EntityNotFoundError("Project", eid)
        assert "Project" in str(e)
        assert str(eid) in str(e)
        assert isinstance(e, DomainError)

    def test_tenant_mismatch(self):
        e = TenantMismatchError()
        assert "tenant" in str(e).lower()

    def test_invalid_state_transition(self):
        e = InvalidStateTransitionError("Task", "todo", "done")
        assert "todo" in str(e)
        assert "done" in str(e)

    def test_authorization_error(self):
        e = AuthorizationError("delete", "project")
        assert "delete" in str(e)
        assert "project" in str(e)

    def test_duplicate_entity(self):
        e = DuplicateEntityError("User", "email", "a@b.com")
        assert "a@b.com" in str(e)

    def test_business_rule_violation(self):
        e = BusinessRuleViolationError("Hours exceed 24")
        assert "Hours exceed 24" in str(e)

    def test_all_inherit_from_domain_error(self):
        for exc_class in [
            EntityNotFoundError,
            TenantMismatchError,
            InvalidStateTransitionError,
            AuthorizationError,
            DuplicateEntityError,
            BusinessRuleViolationError,
        ]:
            assert issubclass(exc_class, DomainError)
