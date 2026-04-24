import json
import logging
from uuid import UUID

from fastapi import (
    APIRouter,
    Query,
    WebSocket,
    WebSocketDisconnect,
    WebSocketException,
    status,
)
from pydantic import ValidationError

from app.api.security.deps import decode_jwt_token
from app.data.control.model.message import ControlMessage
from app.service.drone.drone_service import DroneServiceDep
from app.service.exceptions import InvalidTokenError, NonExistentDroneException
from app.service.messaging.messaging_service import MessagingServiceDep
from app.service.user.user_service import UserServiceDep

router = APIRouter(prefix="/control", tags=["control"])

logger = logging.getLogger(__name__)


@router.websocket("/{drone_id}")
async def control_socket(
    websocket: WebSocket,
    drone_id: UUID,
    user_service: UserServiceDep,
    drone_service: DroneServiceDep,
    messaging: MessagingServiceDep,
    # Browsers can't set headers on native WebSocket connections,
    # so we accept the JWT as a query param.
    token: str = Query(),
):
    # Authenticate and authorize the connection. JWKS / infrastructure errors
    # intentionally propagate — they're not the client's fault and shouldn't
    # look like an auth failure.
    try:
        decoded = decode_jwt_token(token)
        user = user_service.sync_from_token(decoded)
        drone = drone_service.get_drone(drone_id)
    except InvalidTokenError | NonExistentDroneException as e:
        if isinstance(e, InvalidTokenError):
            logger.warning(
                f"Websocket authentication rejected for drone {drone_id}, reason '{e.message}'"
            )
        elif isinstance(e, NonExistentDroneException):
            logger.warning("The drone with id '{drone_id}' does not exist")
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    if not user.is_admin and drone.owner_id != user.id:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    await websocket.accept()
    logger.info(f"Control socket opened for drone {drone_id} by user {user.id}")

    try:
        while True:
            try:
                raw = await websocket.receive_json()
                msg = ControlMessage.model_validate(raw)
            except (json.JSONDecodeError, ValidationError) as e:
                logger.warning(
                    f"Dropping invalid control message from user {user.id} "
                    f"drone {drone_id}: {e}"
                )
                continue

            await messaging.publish_control(
                str(drone_id), msg.model_dump_json().encode()
            )
    except WebSocketDisconnect:
        logger.info(
            f"Control websocket connection closed for drone {drone_id}, user: {user.id}"
        )
