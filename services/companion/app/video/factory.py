from config import (
    RpicamVideoSourceConfig,
    RtspVideoPublisherConfig,
    Settings,
    VideoPublisherConfig,
    VideoSourceConfig,
)

from video.gazebo.gazebo import GazeboVideoSource
from video.pipeline import VideoPipeline
from video.publisher import VideoPublisher
from video.rpi.rpi import RpicamVideoSource
from video.rtsp import RtspPublisher
from video.source import VideoSource
from video.whip import WhipPublisher


def _build_source(source: VideoSourceConfig) -> VideoSource:
    if isinstance(source, RpicamVideoSourceConfig):
        return RpicamVideoSource(
            width=source.width,
            height=source.height,
            fps=source.fps,
            bitrate=source.bitrate,
        )

    return GazeboVideoSource(port=source.port)


def _build_publisher(
    publisher: VideoPublisherConfig,
    drone_id: str,
    drone_secret: str,
    media_server_url: str,
) -> VideoPublisher:
    if isinstance(publisher, RtspVideoPublisherConfig):
        return RtspPublisher(
            drone_id=drone_id,
            drone_secret=drone_secret,
            media_server_url=media_server_url,
            secure=publisher.secure,
        )

    return WhipPublisher(
        drone_id=drone_id,
        drone_secret=drone_secret,
        media_server_url=media_server_url,
        secure=publisher.secure,
    )


def build_video_pipeline(settings: Settings) -> VideoPipeline | None:
    if settings.video is None:
        return None

    return VideoPipeline(
        source=_build_source(settings.video.source),
        publisher=_build_publisher(
            settings.video.publisher,
            drone_id=settings.drone_id,
            drone_secret=settings.drone_secret,
            media_server_url=settings.video.media_server_url,
        ),
    )
