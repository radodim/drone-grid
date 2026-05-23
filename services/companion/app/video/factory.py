from config import GazeboVideo, RpicamVideo, Settings

from video.gazebo.gazebo import GazeboSource
from video.mediamtx.mediamtx import MediaMtxPublisher
from video.pipeline import VideoPipeline
from video.publisher import VideoPublisher
from video.rpi.rpi import RpicamSource
from video.source import VideoSource


def __build_source(source: RpicamVideo | GazeboVideo) -> VideoSource:
    if isinstance(source, RpicamVideo):
        return RpicamSource(
            width=source.width,
            height=source.height,
            fps=source.fps,
            bitrate=source.bitrate,
        )
    return GazeboSource(port=source.port)


def __build_publisher(settings: Settings, media_server_url: str) -> VideoPublisher:
    # TODO: remove mediamtx - make it rtsp publisher
    # Only MediaMTX is implemented today. When WebRTC / other sinks appear,
    # promote this to dispatching on a PublisherConfig discriminated union
    # living next to VideoConfig.
    return MediaMtxPublisher(
        drone_id=settings.drone_id,
        drone_secret=settings.drone_secret,
        media_server_url=media_server_url,
    )


def build_video_pipeline(settings: Settings) -> VideoPipeline | None:
    if settings.video is None:
        return None
    return VideoPipeline(
        source=__build_source(settings.video.source),
        publisher=__build_publisher(settings, settings.video.media_server_url),
    )
