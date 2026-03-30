import httpx

from app.service.exceptions import MediaServerException
from app.service.media.media_service import MediaService


class MediaMtxMediaService(MediaService):
    # TODO: Add logging!

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
            # TODO: See async HTTP API
            resp = httpx.get(f"{self._media_server_control_api_base_url}/paths/list")
            resp.raise_for_status()
            items = resp.json().get("items", [])
            self.__active_streams = {
                item["name"] for item in items if item.get("ready")
            }
        except httpx.HTTPError:
            # TODO: Add logger.error("Requested to mediamtx failed, str(e) and differentiate between unavailable and status code failure.")
            raise MediaServerException("Request to media server control API failed.")

        return self.__active_streams
