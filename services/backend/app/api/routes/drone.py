from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.request.drone_create import DroneCreate
from app.api.response.drone_response import DroneResponse
from app.api.security.deps import CurrentUser
from app.data.db.model.drone import Drone
from app.service.drone.drone_service import DroneServiceDep
from app.service.exceptions import NonExistentDroneException
from app.service.media.media_service_factory import MediaServiceDep

router = APIRouter(prefix="/drone", tags=["drone"], redirect_slashes=False)


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
    drone = drone_service.get_drone(drone_id)

    # Don't leak that the drone exists by returning status.HTTP_403_FORBIDDEN
    if not user.is_admin and drone.owner_id != user.id:
        raise NonExistentDroneException(f"Drone with id {drone_id} does not exist.")

    return DroneResponse.from_drone(drone)


@router.delete("/{drone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_drone(
    drone_id: UUID,
    user: CurrentUser,
    drone_service: DroneServiceDep,
):
    drone: Drone = drone_service.get_drone(drone_id)

    if not user.is_admin and drone.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    drone_service.delete_drone(drone=drone)
