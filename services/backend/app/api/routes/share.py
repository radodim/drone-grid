from fastapi import APIRouter

from app.api.response.share_response import ShareResolvedResponse
from app.service.share.share_service import ShareServiceDep

# no auth here in order to support link sharing.
router = APIRouter(tags=["shares"], redirect_slashes=False)


@router.get("/shares/{token}")
def resolve_share(
    token: str,
    share_service: ShareServiceDep,
) -> ShareResolvedResponse:
    share = share_service.resolve(token)  # share's FK guarantees an existing drone
    return ShareResolvedResponse(drone_id=share.drone_id)
