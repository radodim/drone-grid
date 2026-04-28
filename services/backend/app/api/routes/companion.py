import base64
import binascii
import json
import logging
import secrets
from uuid import UUID

from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
    WebSocketException,
    status,
)
from pydantic import ValidationError

from app.data.control.model.message import ControlMessage
from app.data.telemetry.model.telemetry import Telemetry
from app.service.drone.drone_service import DroneServiceDep
from app.service.exceptions import NonExistentDroneException
from app.service.messaging.messaging_service import MessagingServiceDep

router = APIRouter(prefix="/companion", tags=["companion"])

logger = logging.getLogger(__name__)


@router.websocket("")
async def companion_socket(
    websocket: WebSocket,
    drone_service: DroneServiceDep,
    messaging: MessagingServiceDep,
):
    """Bidirectional bridge between a companion process and the internal
    messaging bus.

    The companion is a server-side client (Python on the Pi) so it can set
    HTTP headers — unlike the browser's /control endpoint which has to fall
    back to a query param. We use HTTP Basic Auth: drone_id as the username,
    drone_secret as the password.

    Wire contract: JSON in both directions, validated against
    `ControlMessage` (incoming on the NATS side, forwarded to the companion)
    and `Telemetry` (incoming on the WebSocket, forwarded to NATS). The
    backend doesn't act on either — it's a typed dumb pipe whose only role
    on top of forwarding is rejecting malformed payloads at the seam.
    """
    drone = _authenticate(websocket, drone_service)
    drone_id = str(drone.id)

    await websocket.accept()
    logger.info(f"Companion socket opened for drone {drone_id}")

    async def _forward_control(message: ControlMessage) -> None:
        try:
            await websocket.send_bytes(message.model_dump_json().encode())
        except Exception:
            # The websocket may have closed mid-forward. The receive loop
            # below will see the disconnect and unwind cleanly.
            logger.exception(
                f"Failed to forward control message to companion for drone {drone_id}"
            )

    async with messaging.subscribe_control(drone_id, _forward_control):
        try:
            while True:
                try:
                    raw = await websocket.receive_json()
                    telemetry = Telemetry.model_validate(raw)
                except (json.JSONDecodeError, ValidationError) as e:
                    logger.warning(
                        f"Dropping invalid telemetry from drone {drone_id}: {e}"
                    )
                    continue

                await messaging.publish_telemetry(drone_id, telemetry)
        except WebSocketDisconnect:
            logger.info(f"Companion socket closed for drone {drone_id}")


def _authenticate(websocket: WebSocket, drone_service):
    """Validate HTTP Basic Auth credentials against the Drone record.

    Any failure (missing header, malformed encoding, unknown drone, secret
    mismatch) collapses to the same WS_1008_POLICY_VIOLATION close code —
    we don't tell the client which check failed.
    """
    auth_header = websocket.headers.get("authorization", "")
    if not auth_header.lower().startswith("basic "):
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    try:
        decoded = base64.b64decode(auth_header[6:], validate=True).decode("utf-8")
    except (binascii.Error, UnicodeDecodeError):
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    username, sep, password = decoded.partition(":")
    if not sep:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    try:
        drone_uuid = UUID(username)
        drone = drone_service.get_drone(drone_uuid)
    except (ValueError, NonExistentDroneException):
        logger.warning(
            f"Companion socket auth rejected: unknown or malformed drone id '{username}'"
        )
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    if not secrets.compare_digest(drone.secret_key, password):
        logger.warning(
            f"Companion socket auth rejected: secret mismatch for drone {drone.id}"
        )
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    return drone
