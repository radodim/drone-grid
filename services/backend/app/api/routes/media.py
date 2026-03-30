from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.api.security.deps import decode_jwt_token
from app.service.drone.drone_service import DroneService, DroneServiceDep
from app.service.media.mediamtx.mediamtx_auth_request_model import (
    MediaMtxAuthRequestModel,
)
from app.service.user.user_service import UserService, UserServiceDep

router = APIRouter(prefix="/media", redirect_slashes=False)


@router.post("/auth")
def media_auth(
    body: MediaMtxAuthRequestModel,
    drone_service: DroneServiceDep,
    user_service: UserServiceDep,
):
    if body.protocol == "rtsp" and body.action == "publish":
        return __validate_drone_publish(body, drone_service)

    if body.protocol == "webrtc" and body.action == "read":
        return __validate_user_read(body, drone_service, user_service)

    raise HTTPException(status_code=401, detail="Unauthorized")


def __validate_drone_publish(
    body: MediaMtxAuthRequestModel, drone_service: DroneService
):
    drone_id = __parse_uuid(body.user, "Invalid drone ID")
    drone = drone_service.get_drone(drone_id)

    if drone.secret_key != body.password:
        raise HTTPException(status_code=401, detail="Invalid secret key")

    if body.path != str(drone.id):
        raise HTTPException(status_code=401, detail="Path must match drone ID")

    return {"ok": True}


def __validate_user_read(
    body: MediaMtxAuthRequestModel,
    drone_service: DroneService,
    user_service: UserService,
):
    if not body.token:
        raise HTTPException(status_code=401, detail="Missing token")

    decoded_token = decode_jwt_token(body.token)
    user = user_service.sync_from_token(decoded_token)

    if user.is_admin:
        return {"ok": True}

    drone_id = __parse_uuid(body.path, "Invalid stream path")
    drone = drone_service.get_drone(drone_id)
    if drone.owner_id != user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to view this stream"
        )

    return {"ok": True}


def __parse_uuid(value: str, detail: str) -> UUID:
    try:
        return UUID(value)
    except ValueError:
        raise HTTPException(status_code=401, detail=detail)
