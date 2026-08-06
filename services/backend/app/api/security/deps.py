import logging
from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.config import GLOBAL_APP_SETTINGS
from app.data.db.model.user import User
from app.service.exceptions import InvalidTokenError
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
    """Validate a Keycloak-issued JWT and return its claims.

    Raises:
        InvalidTokenError: the token itself failed validation (client's fault).
        jwt.PyJWKClientError: couldn't reach / parse JWKS (our infrastructure's
            fault) — logged here and re-raised so it surfaces as a 500 rather
            than masquerading as a 401.
    """
    try:
        signing_key = __JWKS_CLIENT.get_signing_key_from_jwt(jwt_token)
    except jwt.PyJWKClientError:
        logger.exception(
            "JWKS lookup failed, there is an issue with the connection to the identity server"
        )
        raise

    try:
        return jwt.decode(
            jwt_token,
            signing_key,
            algorithms=["RS256"],
            audience=GLOBAL_APP_SETTINGS.KEYCLOAK_AUDIENCE,
            issuer=GLOBAL_APP_SETTINGS.KEYCLOAK_ISSUER,
        )
    except jwt.ExpiredSignatureError:
        raise InvalidTokenError("The token has expired.")
    except jwt.InvalidAudienceError:
        raise InvalidTokenError("The audience listed in the token is invalid.")
    except jwt.InvalidIssuerError:
        raise InvalidTokenError("The issuer listed in the token is invalid.")
    except jwt.InvalidSignatureError:
        raise InvalidTokenError("The token signature is invalid.")
    except jwt.DecodeError:
        raise InvalidTokenError("A malformed token has been provided.")
    except jwt.PyJWTError as e:
        # Catch-all for remaining token-validation errors: ImmatureSignature,
        # MissingRequiredClaim, etc. Non-JWT exceptions
        # propagate and become 500s — this is intentional (see docstring).
        raise InvalidTokenError(f"Invalid token: {e}")
