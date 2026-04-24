from abc import ABC, abstractmethod


class VideoPublisher(ABC):
    """Consumes an H.264 byte stream from stdin and delivers it to a sink.

    Concrete subclasses return the argv for a subprocess that reads H.264 on
    stdin and muxes/transports it to wherever the sink lives (RTSP server,
    file, WebRTC ingest, cloud pipeline, …).
    """

    @abstractmethod
    async def build_command(self) -> list[str]:
        pass
