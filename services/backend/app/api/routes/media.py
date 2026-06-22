from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.api.security.deps import decode_jwt_token
from app.service.drone.drone_service import DroneService, DroneServiceDep
from app.service.exceptions import InvalidShareTokenError
from app.service.media.mediamtx.mediamtx_auth_request_model import (
    MediaMtxAuthRequestModel,
)
from app.service.share.share_service import (
    SHARE_TOKEN_PREFIX,
    ShareService,
    ShareServiceDep,
)
from app.service.user.user_service import UserService, UserServiceDep

router = APIRouter(prefix="/media", tags=["media"], redirect_slashes=False)


@router.post("/auth", include_in_schema=False)
def media_auth(
    body: MediaMtxAuthRequestModel,
    drone_service: DroneServiceDep,
    user_service: UserServiceDep,
    share_service: ShareServiceDep,
):
    if body.protocol == "rtsp" and body.action == "publish":
        return __validate_drone_publish(body, drone_service)

    if body.protocol == "webrtc" and body.action == "read":
        return __validate_read(body, drone_service, user_service, share_service)

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


def __validate_read(
    body: MediaMtxAuthRequestModel,
    drone_service: DroneService,
    user_service: UserService,
    share_service: ShareService,
):
    if not body.token:
        raise HTTPException(status_code=401, detail="Missing token")

    # A share link (dgs_) grants view-only access to exactly its drone's path.
    if body.token.startswith(SHARE_TOKEN_PREFIX):
        return __validate_share_read(body, share_service)

    return __validate_user_read(body, drone_service, user_service)


def __validate_share_read(body: MediaMtxAuthRequestModel, share_service: ShareService):
    try:
        share = share_service.resolve(body.token)
    except InvalidShareTokenError:
        raise HTTPException(
            status_code=403, detail="Not authorized to view this stream"
        )

    if body.path != str(share.drone_id):
        raise HTTPException(
            status_code=403, detail="Not authorized to view this stream"
        )

    return {"ok": True}


def __validate_user_read(
    body: MediaMtxAuthRequestModel,
    drone_service: DroneService,
    user_service: UserService,
):
    decoded_token = decode_jwt_token(body.token)
    user = user_service.sync_from_token(decoded_token)

    if user.is_admin:
        return {"ok": True}

    drone_id = __parse_uuid(body.path, "Invalid stream path")
    drone = drone_service.get_drone(drone_id)
    if drone.creation_user_id != user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to view this stream"
        )

    return {"ok": True}


def __parse_uuid(value: str, detail: str) -> UUID:
    try:
        return UUID(value)
    except ValueError:
        raise HTTPException(status_code=401, detail=detail)
