from config import GazeboVideo, NoVideo, RpicamVideo, Settings
from video.gazebo.gazebo import GazeboSource
from video.mediamtx.mediamtx import MediaMtxPublisher
from video.pipeline import VideoPipeline
from video.publisher import VideoPublisher
from video.rpi.rpi import RpicamSource
from video.source import VideoSource


def _build_source(video: RpicamVideo | GazeboVideo) -> VideoSource:
    if isinstance(video, RpicamVideo):
        return RpicamSource(
            width=video.width,
            height=video.height,
            fps=video.fps,
            bitrate=video.bitrate,
        )
    return GazeboSource(port=video.port)


def _build_publisher(settings: Settings) -> VideoPublisher:
    # Only MediaMTX is implemented today. When WebRTC / other sinks appear,
    # promote this to dispatching on a PublisherConfig discriminated union
    # living next to VideoConfig.
    return MediaMtxPublisher(
        drone_id=settings.drone_id,
        drone_secret=settings.drone_secret,
        media_server_url=settings.media_server_url,
    )


def build_video_pipeline(settings: Settings) -> VideoPipeline | None:
    """Construct the video pipeline from settings, or None if video is off.

    Callers start/stop the returned pipeline themselves — the factory only
    composes, never owns lifecycle.
    """
    if isinstance(settings.video, NoVideo):
        return None
    return VideoPipeline(
        source=_build_source(settings.video),
        publisher=_build_publisher(settings),
    )
