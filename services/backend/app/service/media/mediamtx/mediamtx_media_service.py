import logging

import httpx

from app.service.exceptions import MediaServerException
from app.service.media.media_service import MediaService

logger = logging.getLogger(__name__)


class MediaMtxMediaService(MediaService):
    def __init__(
        self, media_server_control_api_base_url: str, stream_base_url: str
    ) -> None:
        super().__init__(media_server_control_api_base_url, stream_base_url)
        self.__active_streams: set[str] | None = None

    @property
    def _active_streams(self) -> set[str]:
        if self.__active_streams is not None:
            return self.__active_streams

        try:
            # TODO: consider adapting async httpx API
            resp = httpx.get(f"{self._media_server_control_api_base_url}/paths/list")
            resp.raise_for_status()
            items = resp.json().get("items", [])
            self.__active_streams = {
                item["name"] for item in items if item.get("ready")
            }
        except httpx.HTTPError:
            msg = "Requested to mediamtx failed control API failed."
            logger.error(msg)
            raise MediaServerException(msg)

        return self.__active_streams
