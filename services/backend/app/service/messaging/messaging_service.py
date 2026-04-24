import logging
from typing import Annotated

import nats
from fastapi import Depends
from nats.aio.client import Client as NATSClient
from starlette.requests import HTTPConnection

from app.config import GLOBAL_APP_SETTINGS

logger = logging.getLogger(__name__)


# TODO: refactor this to be an abstract base class and implement a concrete NATS implementation, also create a factory to initialize the messaging system (NATS default)
# do not take bytes as an argument but the same payload for each impl, convert to bytes if needed in the impl (in the case of NATS)
class MessagingService:
    """Thin wrapper around the app-level NATS client.

    The connection is opened once during FastAPI's lifespan and stored on
    app.state.nats. This dependency exposes publish/subscribe operations
    bound to that shared connection — don't create new NATS clients per-request.
    """

    def __init__(self, nc: NATSClient) -> None:
        self.__nc = nc

    async def publish_control(self, drone_id: str, payload: bytes) -> None:
        await self.__nc.publish(f"drone.{drone_id}.control", payload)

    async def subscribe_telemetry(self, drone_id: str, callback):
        return await self.__nc.subscribe(f"drone.{drone_id}.telemetry", cb=callback)


async def connect_nats() -> NATSClient:
    logger.info(f"Connecting to NATS at {GLOBAL_APP_SETTINGS.NATS_URL}...")
    nc = await nats.connect(GLOBAL_APP_SETTINGS.NATS_URL)
    logger.info("Successfully connected to the NATS messaging system.")
    return nc


def __get_messaging_service(conn: HTTPConnection) -> MessagingService:
    return MessagingService(conn.app.state.nats)


MessagingServiceDep = Annotated[MessagingService, Depends(__get_messaging_service)]
