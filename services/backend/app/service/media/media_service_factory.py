from typing import Annotated

from fastapi import Depends

from app.config import GLOBAL_APP_SETTINGS
from app.service.media.media_service import MediaService
from app.service.media.mediamtx.mediamtx_media_service import MediaMtxMediaService


def get_media_service() -> MediaService:
    # If adding another media server implementation extend this factory method and add env var MEDIA_SERVER
    return MediaMtxMediaService(
        media_server_control_api_base_url=f"{GLOBAL_APP_SETTINGS.MEDIAMTX_API_URL}/v3",
        stream_base_url=GLOBAL_APP_SETTINGS.WEBRTC_BASE_URL,
    )


MediaServiceDep = Annotated[MediaService, Depends(get_media_service)]
