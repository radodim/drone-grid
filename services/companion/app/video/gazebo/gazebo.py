import tempfile
from pathlib import Path

from video.source import VideoSource

_SDP_TEMPLATE = """\
v=0
o=- 0 0 IN IP4 0.0.0.0
s=PX4
c=IN IP4 0.0.0.0
t=0 0
m=video {port} RTP/AVP 96
a=rtpmap:96 H264/90000
"""


class GazeboSource(VideoSource):
    """PX4 Gazebo camera plugin's RTP/H.264 UDP push, unwrapped to raw H.264.

    The plugin pushes RTP to whatever host PX4_VIDEO_HOST_IP points at, on a
    fixed port (default 5600). For this source to receive anything the PX4
    SITL container must be started with PX4_VIDEO_HOST_IP set to this
    companion container's hostname.

    ffmpeg needs an SDP file to know the payload type and clock rate — raw
    RTP on a socket is not self-describing.
    """

    def __init__(self, port: int = 5600) -> None:
        self._port = port

    async def build_command(self) -> list[str]:
        sdp_path = Path(tempfile.gettempdir()) / "px4_stream.sdp"
        sdp_path.write_text(_SDP_TEMPLATE.format(port=self._port))
        return [
            "ffmpeg",
            "-protocol_whitelist", "file,udp,rtp",
            "-fflags", "nobuffer",
            "-flags", "low_delay",
            "-i", str(sdp_path),
            "-c", "copy",
            "-f", "h264",
            "-",
        ]
