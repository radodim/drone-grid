import asyncio
import contextlib
import logging

from config import GLOBAL_APP_SETTINGS, Settings
from drone.controller import DroneController
from messaging.drone_grid.drone_grid import DroneGridMessagingClient
from video.factory import build_video_pipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main(settings: Settings) -> None:
    async with build_video_pipeline(settings) or contextlib.nullcontext():
        control = settings.control
        if control is not None:
            messaging = DroneGridMessagingClient(
                url=control.messaging_url,
                drone_id=settings.drone_id,
                drone_secret=settings.drone_secret,
            )
            async with messaging:
                async with DroneController(
                    connection_url=control.connection_url,
                    messaging=messaging,
                ) as controller:
                    await controller.run()
        else:
            # Video-only: hold the process open until cancelled so the video
            # pipeline subprocess keeps running.
            await asyncio.Event().wait()

    logger.info("Shutdown complete")


if __name__ == "__main__":
    asyncio.run(main(GLOBAL_APP_SETTINGS))
