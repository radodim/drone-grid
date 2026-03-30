from abc import ABC, abstractmethod


class MediaService(ABC):
    def __init__(
        self, media_server_control_api_base_url: str, stream_base_url: str
    ) -> None:
        self._media_server_control_api_base_url: str = media_server_control_api_base_url
        self._stream_base_url: str = stream_base_url

    @property
    @abstractmethod
    def _active_streams(self) -> set[str]:
        pass

    def get_active_streams(self, stream_ids: set[str]) -> dict[str, str]:
        return {
            stream_id: f"{self._stream_base_url}/{stream_id}"
            for stream_id in stream_ids
            if stream_id in self._active_streams
        }
