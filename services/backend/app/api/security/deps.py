import logging
from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.config import GLOBAL_APP_SETTINGS
from app.data.db.model.user import User
from app.service.user.user_service import UserServiceDep

__JWKS_CLIENT = PyJWKClient(GLOBAL_APP_SETTINGS.KEYCLOAK_JWKS_URL)
BearerToken = Annotated[HTTPAuthorizationCredentials, Security(HTTPBearer())]

logger = logging.getLogger(__name__)


def __get_current_user(
    user_service: UserServiceDep,
    credentials: BearerToken,
) -> User:
    decoded_token = decode_jwt_token(credentials.credentials)

    return user_service.sync_from_token(decoded_token)


CurrentUser = Annotated[User, Depends(__get_current_user)]


def __get_admin_user(user: CurrentUser) -> User:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin access required.",
        )

    return user


CurrentAdminUser = Annotated[User, Depends(__get_admin_user)]


def decode_jwt_token(jwt_token: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            jwt_token,
            __JWKS_CLIENT.get_signing_key_from_jwt(jwt_token),
            algorithms=["RS256"],
            audience=GLOBAL_APP_SETTINGS.KEYCLOAK_AUDIENCE,
        )
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Error occurred when decoding the token.",
        )
