from uuid import UUID

from fastapi import APIRouter, status

from app.api.request.drone_create import DroneCreate
from app.api.request.share_create import ShareCreate
from app.api.response.drone_response import DroneResponse, DroneSecretResponse
from app.api.response.share_response import ShareCreatedResponse, ShareResponse
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
) -> DroneSecretResponse:
    drone, secret = drone_service.create_drone(body.name, user_id=user.id)
    return DroneSecretResponse.from_drone_with_secret(drone, secret)


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


@router.post("/{drone_id}/secret", status_code=status.HTTP_200_OK)
def rotate_secret(
    drone_id: UUID, user: CurrentUser, drone_service: DroneServiceDep
) -> DroneSecretResponse:
    drone = __get_drone_if_authorized(drone_id, user, drone_service)
    secret = drone_service.rotate_secret(drone)
    return DroneSecretResponse.from_drone_with_secret(drone, secret)


@router.post("/{drone_id}/shares", status_code=status.HTTP_201_CREATED)
def create_share(
    drone_id: UUID,
    body: ShareCreate,
    user: CurrentUser,
    drone_service: DroneServiceDep,
    share_service: ShareServiceDep,
) -> ShareCreatedResponse:
    __get_drone_if_authorized(drone_id, user, drone_service)
    share, raw_token = share_service.mint(drone_id, user.id, body.ttl_hours, body.label)
    return ShareCreatedResponse(
        id=share.id, token=raw_token, expiration_timestamp=share.expiration_timestamp
    )


@router.get("/{drone_id}/shares")
def list_shares(
    drone_id: UUID,
    user: CurrentUser,
    drone_service: DroneServiceDep,
    share_service: ShareServiceDep,
) -> list[ShareResponse]:
    __get_drone_if_authorized(drone_id, user, drone_service)
    return [
        ShareResponse.from_share(share) for share in share_service.list_active(drone_id)
    ]


@router.get("/{drone_id}/shares/{share_id}")
def get_share(
    drone_id: UUID,
    share_id: UUID,
    user: CurrentUser,
    drone_service: DroneServiceDep,
    share_service: ShareServiceDep,
) -> ShareResponse:
    __get_drone_if_authorized(drone_id, user, drone_service)
    return ShareResponse.from_share(share_service.get(drone_id, share_id))


@router.delete("/{drone_id}/shares/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
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
