from typing import Annotated, Any

from fastapi import Depends
from sqlmodel import select

from app.data.db.model.user import User
from app.data.db.session import DbSessionDep
from app.utils import get_utcnow

# TODO: refactor this class and align with conventions in the project


class UserService:
    def __init__(self, db_session: DbSessionDep) -> None:
        self.__db_session = db_session

    def get_all(self) -> list[User]:
        return list(self.__db_session.exec(select(User)).all())

    def sync_from_token(self, decoded_token: dict[str, Any]) -> User:
        user = self._find_by_token(decoded_token)
        if user:
            self._update(user, decoded_token)
        else:
            user = self._create(decoded_token)
        self.__db_session.commit()
        self.__db_session.refresh(user)

        return user

    def _find_by_token(self, decoded_token: dict[str, Any]) -> User | None:
        return self.__db_session.exec(
            select(User).where(User.sub == decoded_token["sub"])
        ).first()

    def _create(self, decoded_token: dict[str, Any]) -> User:
        user = User(
            sub=decoded_token["sub"],
            issuer=decoded_token["iss"],
            email=decoded_token["email"],
            username=decoded_token.get("preferred_username"),
            first_name=decoded_token.get("given_name"),
            last_name=decoded_token.get("family_name"),
            is_admin=self._has_admin_role(decoded_token),
        )
        self.__db_session.add(user)

        return user

    def _update(self, user: User, decoded_token: dict[str, Any]) -> None:
        user.issuer = decoded_token["iss"]
        user.email = decoded_token["email"]
        user.username = decoded_token.get("preferred_username")
        user.first_name = decoded_token.get("given_name")
        user.last_name = decoded_token.get("family_name")
        user.is_admin = self._has_admin_role(decoded_token)
        user.update_timestamp = get_utcnow()

    @staticmethod
    def _has_admin_role(decoded_token: dict[str, Any]) -> bool:
        return "admin" in decoded_token.get("realm_access", {}).get("roles", [])


UserServiceDep = Annotated[UserService, Depends(UserService)]
