from video.publisher import VideoPublisher


class WhipPublisher(VideoPublisher):
    """Publishes H.264 via WHIP (WebRTC-HTTP Ingestion Protocol).

    Auth: FFmpeg's WHIP muxer ONLY supports Bearer-token auth (the
    `-authorization` flag). It strips URL-embedded basic-auth credentials
    before issuing the HTTP request, so we pass `drone_secret` as the
    Bearer token. MediaMTX surfaces it to the auth callout as `body.token`;
    the drone_id comes from the URL path (parsed by MediaMTX into
    `body.path`).
    """

    def __init__(
        self,
        drone_id: str,
        drone_secret: str,
        media_server_url: str,
        secure: bool = False,
    ) -> None:
        scheme = "https" if secure else "http"
        self._url = f"{scheme}://{media_server_url}/{drone_id}/whip"
        self._auth_token = drone_secret

    async def build_command(self) -> list[str]:
        return [
            "ffmpeg",
            # TEMPORARY: verbose logging to diagnose immediate WHIP termination.
            # Remove `-v debug` once the publish path is stable.
            "-v",
            "debug",
            "-fflags",
            "nobuffer",
            "-flags",
            "low_delay",
            "-f",
            "h264",
            "-i",
            "-",
            "-c:v",
            "copy",
            "-an",
            "-authorization",
            self._auth_token,
            # FFmpeg's WHIP muxer defaults to DTLS-passive. MediaMTX (and
            # most WebRTC SFUs) is also DTLS-passive as the server. Without
            # this flag both sides wait for the other and the handshake
            # deadlocks — session opens and closes immediately.
            "-whip_flags",
            "dtls_active",
            # Default 5000ms is too tight given FFmpeg's experimental WHIP
            # muxer doesn't include ICE candidates in its offer — MediaMTX
            # has to derive the publisher's address from incoming STUN
            # binds (peer-reflexive) and that takes longer than the
            # default. See ossrs/ffmpeg-webrtc#66.
            "-handshake_timeout",
            "30000",
            "-f",
            "whip",
            self._url,
        ]
