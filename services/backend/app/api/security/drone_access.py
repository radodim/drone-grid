import logging
from uuid import UUID

from fastapi import WebSocketException, status

from app.api.security.deps import decode_jwt_token
from app.data.db.model.drone import Drone
from app.data.db.model.user import User
from app.service.drone.drone_service import DroneService
from app.service.exceptions import InvalidTokenError, NonExistentDroneException
from app.service.user.user_service import UserService

logger = logging.getLogger(__name__)


def authorize_drone_access(
    token: str,
    drone_id: UUID,
    user_service: UserService,
    drone_service: DroneService,
) -> tuple[User, Drone]:
    try:
        decoded = decode_jwt_token(token)
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

    if not user.is_admin and drone.owner_id != user.id:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    return user, drone
