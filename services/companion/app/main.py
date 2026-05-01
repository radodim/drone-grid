import asyncio
import contextlib
import logging

from config import GLOBAL_APP_SETTINGS
from drone.controller import DroneController
from messaging.factory import build_messaging_client
from video.factory import build_video_pipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main() -> None:
    async with build_video_pipeline(GLOBAL_APP_SETTINGS) or contextlib.nullcontext():
        async with build_messaging_client(GLOBAL_APP_SETTINGS) as messaging:
            controller = DroneController(
                connection_url=GLOBAL_APP_SETTINGS.mavsdk_connection_url,
                messaging=messaging,
            )
            await controller.connect()
            await messaging.subscribe_control(controller.dispatch)
            logger.info("Subscribed to control channel")

            async with asyncio.TaskGroup() as tg:
                tg.create_task(controller.publish_telemetry())

    logger.info("Shutdown complete")


if __name__ == "__main__":
    asyncio.run(main())
