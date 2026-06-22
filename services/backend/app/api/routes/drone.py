from uuid import UUID

from fastapi import APIRouter, status

from app.api.request.drone_create import DroneCreate
from app.api.request.share_create import ShareCreate
from app.api.response.drone_response import DroneResponse
from app.api.response.share_response import ShareCreated, ShareSummary
from app.api.security.deps import CurrentUser
from app.data.db.model.drone import Drone
from app.data.db.model.user import User
from app.service.drone.drone_service import DroneService, DroneServiceDep
from app.service.exceptions import NonExistentDroneException
from app.service.media.media_service_factory import MediaServiceDep
from app.service.share.share_service import ShareServiceDep

router = APIRouter(prefix="/drones", tags=["drones"], redirect_slashes=False)


@router.get("/")
def list_drones(
    user: CurrentUser,
    drone_service: DroneServiceDep,
    media_service: MediaServiceDep,
) -> list[DroneResponse]:
    # TODO: implement pagination, filtering, sorting, etc.
    if user.is_admin:
        drones = drone_service.get_all_drones()
    else:
        drones = drone_service.get_drones_for_user(user.id)

    stream_urls = media_service.get_active_streams({str(drone.id) for drone in drones})

    return [
        DroneResponse.from_drone(drone, stream_url=stream_urls.get(str(drone.id)))
        for drone in drones
    ]


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_drone(
    body: DroneCreate,
    user: CurrentUser,
    drone_service: DroneServiceDep,
) -> DroneResponse:
    return DroneResponse.from_drone(
        drone_service.create_drone(body.name, user_id=user.id)
    )


@router.get("/{drone_id}")
def get_drone(
    drone_id: UUID, user: CurrentUser, drone_service: DroneServiceDep
) -> DroneResponse:
    return DroneResponse.from_drone(
        __get_drone_if_authorized(drone_id, user, drone_service)
    )


@router.delete("/{drone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_drone(drone_id: UUID, user: CurrentUser, drone_service: DroneServiceDep):
    drone_service.delete_drone(
        drone=__get_drone_if_authorized(drone_id, user, drone_service)
    )


# ---------------------------------------------------------------------------
# Share links — authenticated, owner-scoped CRUD over a drone's sub-resource.
# (The PUBLIC, anonymous resolve endpoint lives in share.py.)
# ---------------------------------------------------------------------------


@router.post("/{drone_id}/shares", status_code=status.HTTP_201_CREATED)
def create_share(
    drone_id: UUID,
    body: ShareCreate,
    user: CurrentUser,
    drone_service: DroneServiceDep,
    share_service: ShareServiceDep,
) -> ShareCreated:
    __get_drone_if_authorized(drone_id, user, drone_service)
    share, raw_token = share_service.mint(drone_id, user.id, body.ttl_hours, body.label)
    return ShareCreated(
        id=share.id, token=raw_token, expires_at=share.expiration_timestamp
    )


@router.get("/{drone_id}/shares")
def list_shares(
    drone_id: UUID,
    user: CurrentUser,
    drone_service: DroneServiceDep,
    share_service: ShareServiceDep,
) -> list[ShareSummary]:
    __get_drone_if_authorized(drone_id, user, drone_service)
    return [
        ShareSummary.from_share(share) for share in share_service.list_active(drone_id)
    ]


@router.get("/{drone_id}/shares/{share_id}")
def get_share(
    drone_id: UUID,
    share_id: UUID,
    user: CurrentUser,
    drone_service: DroneServiceDep,
    share_service: ShareServiceDep,
) -> ShareSummary:
    __get_drone_if_authorized(drone_id, user, drone_service)
    return ShareSummary.from_share(share_service.get(drone_id, share_id))


@router.delete(
    "/{drone_id}/shares/{share_id}", status_code=status.HTTP_204_NO_CONTENT
)
def revoke_share(
    drone_id: UUID,
    share_id: UUID,
    user: CurrentUser,
    drone_service: DroneServiceDep,
    share_service: ShareServiceDep,
):
    __get_drone_if_authorized(drone_id, user, drone_service)
    share_service.revoke(drone_id, share_id)


def __get_drone_if_authorized(
    drone_id: UUID, user: User, drone_service: DroneService
) -> Drone:
    drone = drone_service.get_drone(drone_id)
    # Don't leak that the drone exists by returning 403 to non-owners.
    if not user.is_admin and drone.creation_user_id != user.id:
        raise NonExistentDroneException(f"Drone with id {drone_id} does not exist.")
    return drone
