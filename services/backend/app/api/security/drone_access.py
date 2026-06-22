import logging
from dataclasses import dataclass
from enum import Enum
from uuid import UUID

from fastapi import WebSocketException, status

from app.api.security.deps import decode_jwt_token
from app.data.db.model.drone import Drone
from app.service.drone.drone_service import DroneService
from app.service.exceptions import (
    InvalidShareTokenError,
    InvalidTokenError,
    NonExistentDroneException,
)
from app.service.share.share_service import SHARE_TOKEN_PREFIX, ShareService
from app.service.user.user_service import UserService

logger = logging.getLogger(__name__)


class AccessScope(str, Enum):
    VIEW = "view"  # may observe telemetry + video
    CONTROL = "control"  # may also command the drone


@dataclass
class DroneAccess:
    drone: Drone
    scope: AccessScope
    subject: str  # "user:<id>" or "share:<id>" — for logs/audit


def authorize_drone_access(
    credential: str,
    drone_id: UUID,
    user_service: UserService,
    drone_service: DroneService,
    share_service: ShareService,
) -> DroneAccess:
    """Resolve a credential to a scoped access decision for a drone.

    A share token (``dgs_`` prefix) grants VIEW; a Keycloak JWT from the
    owner/admin grants CONTROL. Callers enforce the scope they require — only
    the control endpoint demands CONTROL, so a share viewer is structurally
    incapable of commanding.
    """
    if credential.startswith(SHARE_TOKEN_PREFIX):
        return __authorize_share(credential, drone_id, drone_service, share_service)
    return __authorize_user(credential, drone_id, user_service, drone_service)


def __authorize_share(
    credential: str,
    drone_id: UUID,
    drone_service: DroneService,
    share_service: ShareService,
) -> DroneAccess:
    try:
        share = share_service.resolve(credential)
        if share.drone_id != drone_id:
            raise InvalidShareTokenError("Share token does not match this drone.")
        drone = drone_service.get_drone(drone_id)
    except (InvalidShareTokenError, NonExistentDroneException):
        logger.warning(f"Share access rejected for drone {drone_id}")
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    return DroneAccess(drone=drone, scope=AccessScope.VIEW, subject=f"share:{share.id}")


def __authorize_user(
    credential: str,
    drone_id: UUID,
    user_service: UserService,
    drone_service: DroneService,
) -> DroneAccess:
    try:
        decoded = decode_jwt_token(credential)
        user = user_service.sync_from_token(decoded)
        drone = drone_service.get_drone(drone_id)
    except InvalidTokenError as e:
        logger.warning(
            f"Websocket authentication rejected for drone {drone_id}, reason '{e.message}'"
        )
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
    except NonExistentDroneException:
        logger.warning(f"The drone with id '{drone_id}' does not exist")
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    if not user.is_admin and drone.creation_user_id != user.id:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    return DroneAccess(
        drone=drone, scope=AccessScope.CONTROL, subject=f"user:{user.id}"
    )
