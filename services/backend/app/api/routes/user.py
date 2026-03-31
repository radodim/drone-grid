from fastapi import APIRouter

from app.api.security.deps import CurrentUser
from app.data.db.model.user import User
from app.service.user.user_service import UserServiceDep

router = APIRouter(prefix="/user", tags=["user"], redirect_slashes=False)


@router.get("/")
def list_users(user: CurrentUser, user_service: UserServiceDep) -> list[User]:
    if user.is_admin:
        return user_service.get_all()

    return [user]


@router.get("/me")
def me(user: CurrentUser) -> User:
    return user
