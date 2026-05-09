from video.source import VideoSource


class RpicamVideoSource(VideoSource):
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
        return [
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
