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

from app.api.security.drone_access import AccessScope, authorize_drone_access
from app.data.control.model.message import ControlMessage
from app.service.drone.drone_service import DroneServiceDep
from app.service.messaging.messaging_service import MessagingServiceDep
from app.service.share.share_service import ShareServiceDep
from app.service.user.user_service import UserServiceDep

router = APIRouter(prefix="/control", tags=["control"])

logger = logging.getLogger(__name__)


@router.websocket("/{drone_id}")
async def control_socket(
    websocket: WebSocket,
    drone_id: UUID,
    user_service: UserServiceDep,
    drone_service: DroneServiceDep,
    share_service: ShareServiceDep,
    messaging: MessagingServiceDep,
    token: str = Query(),  # JWT as quey param for websockets
):
    access = authorize_drone_access(
        token, drone_id, user_service, drone_service, share_service
    )
    if access.scope != AccessScope.CONTROL:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    await websocket.accept()
    logger.info(f"Control socket opened for drone {drone_id} by {access.subject}")

    try:
        while True:
            try:
                json_line = await websocket.receive_json()
                message = ControlMessage.model_validate(json_line)
            except (json.JSONDecodeError, ValidationError) as e:
                logger.warning(
                    f"Dropping invalid control message from {access.subject} "
                    f"drone {drone_id}: {e}"
                )
                continue

            await messaging.publish_control(str(drone_id), message)
    except WebSocketDisconnect:
        logger.info(f"Control websocket closed for drone {drone_id}, {access.subject}")
