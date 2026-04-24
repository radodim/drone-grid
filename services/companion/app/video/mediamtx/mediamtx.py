from video.publisher import VideoPublisher


class MediaMtxPublisher(VideoPublisher):
    """Publishes stdin H.264 to a MediaMTX RTSP path named after drone_id,
    authenticating as (drone_id, drone_secret).

    RTSP over TCP is chosen intentionally: the companion's uplink on a Pi is
    often cellular, where UDP RTP is prone to silent packet loss. Paying the
    TCP overhead here beats corrupt frames downstream.
    """

    def __init__(
        self,
        drone_id: str,
        drone_secret: str,
        media_server_url: str,
    ) -> None:
        self._url = (
            f"rtsp://{drone_id}:{drone_secret}@{media_server_url}/{drone_id}"
        )

    async def build_command(self) -> list[str]:
        return [
            "ffmpeg",
            "-fflags", "nobuffer",
            "-flags", "low_delay",
            "-i", "-",
            "-c", "copy",
            "-f", "rtsp",
            "-rtsp_transport", "tcp",
            self._url,
        ]
