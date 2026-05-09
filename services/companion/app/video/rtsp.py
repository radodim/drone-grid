from video.publisher import VideoPublisher


class RtspPublisher(VideoPublisher):
    def __init__(
        self,
        drone_id: str,
        drone_secret: str,
        media_server_url: str,
        secure: bool = False,
    ) -> None:
        scheme = "rtsps" if secure else "rtsp"
        self._url = f"{scheme}://{drone_id}:{drone_secret}@{media_server_url}/{drone_id}"

    async def build_command(self) -> list[str]:
        return [
            "ffmpeg",
            "-fflags",
            "nobuffer",
            "-flags",
            "low_delay",
            "-i",
            "-",
            "-c",
            "copy",
            "-f",
            "rtsp",
            "-rtsp_transport",
            "tcp",
            self._url,
        ]
