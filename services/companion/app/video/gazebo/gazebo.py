import tempfile
from pathlib import Path

from app.video.process import VideoProcess

SDP_TEMPLATE = """\
v=0
o=- 0 0 IN IP4 0.0.0.0
s=PX4
c=IN IP4 0.0.0.0
t=0 0
m=video {port} RTP/AVP 96
a=rtpmap:96 H264/90000
"""


class GazeboVideoSource(VideoProcess):
    def __init__(self, port: int = 5600) -> None:
        self.__port = port

    def build_command(self) -> list[str]:
        sdp_path = Path(tempfile.gettempdir()) / "px4_stream.sdp"
        sdp_path.write_text(SDP_TEMPLATE.format(port=self.__port))
        return [
            "ffmpeg",
            "-protocol_whitelist",
            "file,udp,rtp",
            "-fflags",
            "nobuffer",
            "-flags",
            "low_delay",
            "-i",
            str(sdp_path),
            "-c",
            "copy",
            "-f",
            "h264",
            "-",
        ]
