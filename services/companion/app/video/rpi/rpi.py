from app.video.process import VideoProcess


class RpicamVideoSource(VideoProcess):
    def __init__(
        self,
        width: int,
        height: int,
        fps: int,
        bitrate: str,
        vflip: bool = False,
        hflip: bool = False,
    ) -> None:
        self.__width = width
        self.__height = height
        self.__fps = fps
        self.__bitrate = bitrate
        self.__vflip = vflip
        self.__hflip = hflip

    def build_command(self) -> list[str]:
        cmd = [
            "rpicam-vid",
            "-t",
            "0",
            "--codec",
            "h264",
            "--level",
            "4.2",
            "--framerate",
            str(self.__fps),
            "--width",
            str(self.__width),
            "--height",
            str(self.__height),
            "--bitrate",
            self.__bitrate,
            "--low-latency",
            "--profile",
            "baseline",
            "--intra",
            "12",
            "--inline",
            "--autofocus-mode",
            "manual",
            "--lens-position",
            "default",
        ]

        if self.__vflip:
            cmd.append("--vflip")
        if self.__hflip:
            cmd.append("--hflip")

        cmd += ["-n", "-o", "-"]

        return cmd
