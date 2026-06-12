import asyncio
import logging
from datetime import UTC, datetime

from app.config import GLOBAL_APP_SETTINGS, ControlConfig, Settings, VideoConfig
from app.drone.controller import DroneController
from app.messaging.client import MessagingClient
from app.messaging.drone_grid.drone_grid import DroneGridMessagingClient
from app.models import CompanionState, Telemetry
from app.video.factory import build_video_pipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main(settings: Settings) -> None:
    async with asyncio.TaskGroup() as task_group:
        if settings.video is not None:
            task_group.create_task(
                run_video(settings.video, settings.drone_id, settings.drone_secret)
            )
        if settings.control is not None:
            task_group.create_task(
                run_control(settings.control, settings.drone_id, settings.drone_secret)
            )


async def run_video(
    video_config: VideoConfig, drone_id: str, drone_secret: str
) -> None:
    while True:
        pipeline = build_video_pipeline(video_config, drone_id, drone_secret)
        try:
            await pipeline.start()
            await pipeline.wait_for_exit()
            logger.warning("Video pipeline exited. Restarting...")
        except Exception:
            logger.exception("Exception occurred in video pipeline. Restarting...")
        finally:
            await pipeline.stop()
        await asyncio.sleep(video_config.restart_delay_s)


async def run_control(control: ControlConfig, drone_id: str, drone_secret: str) -> None:
    while True:
        try:
            controller = DroneController(connection_url=control.connection_url)
            messaging = DroneGridMessagingClient(
                url=control.messaging_url,
                drone_id=drone_id,
                drone_secret=drone_secret,
                heartbeat_s=control.heartbeat_s,
            )
            async with asyncio.TaskGroup() as task_group:
                task_group.create_task(controller.run())
                task_group.create_task(messaging.run())
                task_group.create_task(
                    publish_telemetry(messaging, controller, control.telemetry_period_s)
                )
                await messaging.subscribe_control(controller.dispatch)
        except Exception:
            logger.exception(
                "An exception occurred in the control subsystem. Restarting..."
            )
            await asyncio.sleep(control.restart_delay_s)


async def publish_telemetry(
    messaging: MessagingClient, controller: DroneController, period_s: float
) -> None:
    while True:
        mavlink_telemtry = controller.mavlink_telemetry()
        telemetry = Telemetry(
            companion_state=derive_companion_state(controller.is_ready),
            companion_state_timestamp=datetime.now(UTC),
            mavlink_telemetry=mavlink_telemtry,
        )
        try:
            await messaging.publish_telemetry(telemetry)
        except Exception as e:
            logger.error(f"Error occurred when publishing telemetry: {e}")
        await asyncio.sleep(period_s)


def derive_companion_state(is_ready: bool) -> CompanionState:
    return CompanionState.READY if is_ready else CompanionState.CONNECTING


if __name__ == "__main__":
    asyncio.run(main(GLOBAL_APP_SETTINGS))
