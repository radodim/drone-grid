from app.config import GazeboVideo, RpicamVideo, VideoConfig
from app.video.gazebo.gazebo import GazeboVideoSource
from app.video.pipeline import VideoPipeline
from app.video.process import VideoProcess
from app.video.rpi.rpi import RpicamVideoSource
from app.video.rtsp.rtsp import RtspVideoPublisher


def __build_source(source: RpicamVideo | GazeboVideo) -> VideoProcess:
    if isinstance(source, RpicamVideo):
        return RpicamVideoSource(
            width=source.width,
            height=source.height,
            fps=source.fps,
            bitrate=source.bitrate,
            vflip=source.vflip,
            hflip=source.hflip,
        )
    return GazeboVideoSource(port=source.port)


def __build_publisher(
    drone_id: str, drone_secret: str, media_server_url: str, secure: bool
) -> VideoProcess:
    return RtspVideoPublisher(
        drone_id=drone_id,
        drone_secret=drone_secret,
        media_server_url=media_server_url,
        secure=secure,
    )


def build_video_pipeline(
    video: VideoConfig, drone_id: str, drone_secret: str
) -> VideoPipeline:
    return VideoPipeline(
        source=__build_source(video.source),
        publisher=__build_publisher(
            drone_id, drone_secret, video.media_server_url, video.secure
        ),
    )
