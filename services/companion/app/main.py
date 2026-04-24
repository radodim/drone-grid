import asyncio
import contextlib
import logging

from config import GLOBAL_APP_SETTINGS
from drone.controller import DroneController
from messaging.factory import build_messaging_client
from models import ControlMessage
from video.factory import build_video_pipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# TODO: Diagnose the following log messages:
# WARNING:mavsdk_server:Received ack for not-existing command: 176! Ignoring... (mavlink_command_sender.cpp:304)


async def main() -> None:
    control_topic = f"drone.{GLOBAL_APP_SETTINGS.drone_id}.control"
    telemetry_topic = f"drone.{GLOBAL_APP_SETTINGS.drone_id}.telemetry"

    async with build_video_pipeline(GLOBAL_APP_SETTINGS) or contextlib.nullcontext():
        async with build_messaging_client(GLOBAL_APP_SETTINGS) as messaging:
            controller = DroneController(
                connection_url=GLOBAL_APP_SETTINGS.mavsdk_connection_url,
                messaging=messaging,
                telemetry_topic=telemetry_topic,
            )
            await controller.connect()
            await messaging.subscribe(
                control_topic, ControlMessage, controller.dispatch
            )
            logger.info(f"Subscribed to {control_topic}")

            async with asyncio.TaskGroup() as tg:
                tg.create_task(controller.publish_telemetry())

    logger.info("Shutdown complete")


if __name__ == "__main__":
    asyncio.run(main())
