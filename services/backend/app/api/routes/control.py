import json
import logging
from uuid import UUID

from fastapi import (
    APIRouter,
    Query,
    WebSocket,
    WebSocketDisconnect,
)
from pydantic import ValidationError

from app.api.security.drone_access import authorize_drone_access
from app.data.control.model.message import ControlMessage
from app.service.drone.drone_service import DroneServiceDep
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
    user, _ = authorize_drone_access(token, drone_id, user_service, drone_service)

    await websocket.accept()
    logger.info(f"Control socket opened for drone {drone_id} by user {user.id}")

    try:
        while True:
            try:
                raw = await websocket.receive_json()
                message = ControlMessage.model_validate(raw)
            except (json.JSONDecodeError, ValidationError) as e:
                logger.warning(
                    f"Dropping invalid control message from user {user.id} "
                    f"drone {drone_id}: {e}"
                )
                continue

            await messaging.publish_control(str(drone_id), message)
    except WebSocketDisconnect:
        logger.info(
            f"Control websocket connection closed for drone {drone_id}, user: {user.id}"
        )
