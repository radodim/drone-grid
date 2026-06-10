import logging
from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.api.security.drone_access import authorize_drone_access
from app.data.telemetry.model.telemetry import Telemetry
from app.service.drone.drone_service import DroneServiceDep
from app.service.messaging.messaging_service import MessagingServiceDep
from app.service.user.user_service import UserServiceDep

router = APIRouter(prefix="/telemetry", tags=["telemetry"])

logger = logging.getLogger(__name__)


@router.websocket("/{drone_id}")
async def telemetry_socket(
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
    logger.info(f"Telemetry socket opened for drone {drone_id} by user {user.id}")

    async def _forward_telemetry(telemetry: Telemetry) -> None:
        try:
            await websocket.send_text(telemetry.model_dump_json())
        except Exception:
            # The websocket may have closed mid-forward. The receive loop
            # below will see the disconnect and unwind cleanly.
            logger.exception(
                f"Failed to forward telemetry to client for drone {drone_id}"
            )

    async with messaging.subscribe_telemetry(str(drone_id), _forward_telemetry):
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            logger.info(
                f"Telemetry socket closed for drone {drone_id}, user: {user.id}"
            )
