import httpx

from app.service.exceptions import MediaServerError
from app.service.media.media_service import MediaService


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
        except httpx.HTTPError as e:
            raise MediaServerError("MediaMTX control API request failed.") from e

        return self.__active_streams
