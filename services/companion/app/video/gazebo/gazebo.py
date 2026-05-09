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


class GazeboVideoSource(VideoSource):
    """PX4 Gazebo camera plugin's RTP/H.264 UDP push, transcoded to
    WebRTC-compatible H.264.

    The plugin pushes RTP to whatever host PX4_VIDEO_HOST_IP points at, on a
    fixed port (default 5600). For this source to receive anything the PX4
    SITL container must be started with PX4_VIDEO_HOST_IP set to this
    companion container's hostname.

    PX4's Gazebo plugin emits H.264 in `High 4:4:4 Predictive` profile with
    yuv444p chroma — neither of which WebRTC accepts. We re-encode to
    constrained_baseline / yuv420p via libopenh264 (LGPL, included in the
    BtbN ffmpeg build) so the publisher can passthrough to either RTSP or
    WHIP without further codec work.

    The Pi's rpicam-vid produces baseline yuv420p natively, so RpicamSource
    can passthrough without re-encoding. Re-encoding here is a SITL-only
    cost paid because of the simulator's output format.

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
            "-protocol_whitelist",
            "file,udp,rtp",
            "-fflags",
            "nobuffer",
            "-flags",
            "low_delay",
            "-i",
            str(sdp_path),
            "-an",
            "-c:v",
            "libopenh264",
            "-profile:v",
            "constrained_baseline",
            "-pix_fmt",
            "yuv420p",
            "-b:v",
            "2M",
            # Short GOP (1s at 30fps) with frequent keyframes so WebRTC late
            # joiners can decode quickly.
            "-g",
            "30",
            "-f",
            "h264",
            "-",
        ]
