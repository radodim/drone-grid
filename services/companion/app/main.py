import asyncio
import logging
from datetime import UTC, datetime

from config import GLOBAL_APP_SETTINGS, ControlConfig, Settings
from drone.controller import DroneController
from messaging.client import MessagingClient
from messaging.drone_grid.drone_grid import DroneGridMessagingClient
from models import CompanionState, MavlinkTelemetry, Telemetry
from video.factory import build_video_pipeline
from video.pipeline import VideoPipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# TODO: externalize these in config.py with default values
CONTROL_RESTART_DELAY_SECONDS = 5.0
TELEMETRY_PERIOD_SECONDS = 0.5  # 2 Hz


async def main(settings: Settings) -> None:
    async with asyncio.TaskGroup() as task_group:
        video_pipeline = build_video_pipeline(settings)
        if video_pipeline is not None:
            task_group.create_task(run_video(video_pipeline))
        if settings.control is not None:
            task_group.create_task(
                run_control(settings.control, settings.drone_id, settings.drone_secret)
            )
    logger.info("Shutdown complete")


async def run_video(pipeline: VideoPipeline) -> None:
    async with pipeline:  # TODO: why was this model as a context manager?
        await asyncio.Event().wait()


async def run_control(control: ControlConfig, drone_id: str, drone_secret: str) -> None:
    while True:
        try:
            controller = DroneController(connection_url=control.connection_url)
            async with DroneGridMessagingClient(
                url=control.messaging_url,
                drone_id=drone_id,
                drone_secret=drone_secret,
            ) as messaging:
                async with asyncio.TaskGroup() as task_group:
                    task_group.create_task(controller.run())
                    task_group.create_task(publish_telemetry(messaging, controller))
                    await messaging.subscribe_control(controller.dispatch)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception(
                f"Control subsystem crashed; restarting in {CONTROL_RESTART_DELAY_SECONDS}s"
            )
            await asyncio.sleep(CONTROL_RESTART_DELAY_SECONDS)


async def publish_telemetry(
    messaging: MessagingClient, controller: DroneController
) -> None:
    while True:
        mavlink_telemtry = controller.mavlink_telemetry()
        telemetry = Telemetry(
            companion_state=derive_companion_state(
                mavlink_telemtry, controller.is_ready
            ),
            companion_state_timestamp=datetime.now(UTC),
            mavlink_telemetry=mavlink_telemtry,
        )
        try:
            await messaging.publish_telemetry(telemetry)
        except Exception as e:
            logger.error(f"Telemetry publish error: {e}")
        await asyncio.sleep(TELEMETRY_PERIOD_SECONDS)


def derive_companion_state(
    mavlink: MavlinkTelemetry | None, is_ready: bool
) -> CompanionState:
    if is_ready:
        return CompanionState.READY
    if mavlink is not None:
        return CompanionState.CALIBRATING

    return CompanionState.CONNECTING


if __name__ == "__main__":
    asyncio.run(main(GLOBAL_APP_SETTINGS))
