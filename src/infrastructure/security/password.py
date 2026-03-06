from passlib.context import CryptContext

from src.application.use_cases.users.register_user import PasswordHasher

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class BcryptPasswordHasher(PasswordHasher):
    def hash(self, password: str) -> str:
        return _pwd_context.hash(password)

    def verify(self, password: str, hashed: str) -> bool:
        return _pwd_context.verify(password, hashed)
