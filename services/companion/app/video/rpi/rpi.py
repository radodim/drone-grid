from video.source import VideoSource


class RpicamSource(VideoSource):
    """H.264 from the Pi's CSI camera via rpicam-vid, written to stdout.

    Encoder settings match the original shell pipeline — low-latency,
    baseline profile, short GOP with inline SPS/PPS so decoders can join
    the stream mid-flight without waiting for the next IDR.
    """

    def __init__(
        self,
        width: int,
        height: int,
        fps: int,
        bitrate: str,
    ) -> None:
        self._width = width
        self._height = height
        self._fps = fps
        self._bitrate = bitrate

    async def build_command(self) -> list[str]:
        return [  # TODO: see why ruff automatically formats this for each list element to be on a new line, I'm not a fan personally
            "rpicam-vid",
            "-t",
            "0",
            "--codec",
            "h264",
            "--level",
            "4.2",
            "--framerate",
            str(self._fps),
            "--width",
            str(self._width),
            "--height",
            str(self._height),
            "--bitrate",
            self._bitrate,
            "--low-latency",
            "--profile",
            "baseline",
            "--intra",
            "12",
            "--inline",
            "-n",
            "-o",
            "-",
        ]
