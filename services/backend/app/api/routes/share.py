from fastapi import APIRouter

from app.api.response.share_response import ShareResolved
from app.service.drone.drone_service import DroneServiceDep
from app.service.share.share_service import ShareServiceDep

# PUBLIC router — every endpoint here is intentionally anonymous (no auth).
router = APIRouter(tags=["shares"], redirect_slashes=False)


@router.get("/shares/{token}")
def resolve_share(
    token: str,
    drone_service: DroneServiceDep,
    share_service: ShareServiceDep,
) -> ShareResolved:
    # The opaque token IS the credential; invalid/expired/revoked all collapse
    # to a generic 404 via the exception handler (never reveal which).
    share = share_service.resolve(token)
    drone = drone_service.get_drone(share.drone_id)
    return ShareResolved(drone_id=drone.id, drone_name=drone.name)
