from app.video.process import VideoProcess


class RtspVideoPublisher(VideoProcess):
    def __init__(
        self,
        drone_id: str,
        drone_secret: str,
        media_server_url: str,
        secure: bool = False,
    ) -> None:
        scheme = "rtsps" if secure else "rtsp"
        self.__url = (
            f"{scheme}://{drone_id}:{drone_secret}@{media_server_url}/{drone_id}"
        )

    def build_command(self) -> list[str]:
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
            self.__url,
        ]
