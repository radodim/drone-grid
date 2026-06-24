import logging
from typing import Awaitable, Callable

from nats.aio.client import Client as NatsClient
from nats.aio.msg import Msg as NatsMsg
from nats.aio.subscription import Subscription as NatsSubscription
from pydantic import BaseModel, ValidationError

from app.data.control.model.message import ControlMessage
from app.data.telemetry.model.telemetry import Telemetry
from app.service.messaging.messaging_service import (
    M,
    MessageHandler,
    MessagingService,
    Subscription,
)

logger = logging.getLogger(__name__)

# TODO: refactor here before making project public


class _NatsSubscription(Subscription):
    """Adapter wrapping a `nats.aio.subscription.Subscription` so the only
    NATS-specific type that callers ever see is the broker connection
    inside this module."""

    def __init__(
        self,
        client: NatsClient,
        topic: str,
        deliver: Callable[[NatsMsg], Awaitable[None]],
    ) -> None:
        self._client = client
        self._topic = topic
        self._deliver = deliver
        self._inner: NatsSubscription | None = None

    async def __aenter__(self) -> "_NatsSubscription":
        self._inner = await self._client.subscribe(self._topic, cb=self._deliver)
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if self._inner is not None:
            await self._inner.unsubscribe()
            self._inner = None


class NatsMessagingService(MessagingService):
    """NATS implementation of the messaging service.

    Constructed unconnected. The broker connection is opened in __aenter__
    and drained in __aexit__ so the lifecycle is explicit at the caller
    site. Topic naming convention (`drone.<id>.<channel>`) is encapsulated
    here so callers only think about drones and channels, never subjects.
    """

    def __init__(self, url: str) -> None:
        self.__url = url
        self.__client = NatsClient()

    async def __aenter__(self) -> "NatsMessagingService":
        logger.info(f"Connecting to NATS at {self.__url}...")
        await self.__client.connect(servers=[self.__url])
        logger.info("Successfully connected to the NATS messaging system.")
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.__client.drain()

    async def publish_control(self, drone_id: str, message: ControlMessage) -> None:
        await self.__publish(self.__control_topic(drone_id), message)

    async def publish_telemetry(self, drone_id: str, message: Telemetry) -> None:
        await self.__publish(self.__telemetry_topic(drone_id), message)

    def subscribe_control(
        self, drone_id: str, handler: MessageHandler[ControlMessage]
    ) -> Subscription:
        return self.__subscribe(self.__control_topic(drone_id), ControlMessage, handler)

    def subscribe_telemetry(
        self, drone_id: str, handler: MessageHandler[Telemetry]
    ) -> Subscription:
        return self.__subscribe(self.__telemetry_topic(drone_id), Telemetry, handler)

    async def __publish(self, topic: str, message: BaseModel) -> None:
        await self.__client.publish(topic, message.model_dump_json().encode())

    def __subscribe(
        self, topic: str, model_type: type[M], handler: MessageHandler[M]
    ) -> Subscription:
        # Adapter from NATS's library-native Msg callback to our typed
        # handler. Invalid payloads are logged and dropped — they're
        # almost always schema drift between deploys, not anything the
        # handler can recover from in-flight.
        async def _deliver(msg: NatsMsg) -> None:
            try:
                model = model_type.model_validate_json(msg.data)
            except ValidationError as e:
                logger.warning(f"Dropping invalid message on {topic}: {e}")
                return
            await handler(model)

        return _NatsSubscription(self.__client, topic, _deliver)

    @staticmethod
    def __control_topic(drone_id: str) -> str:
        return f"drone.{drone_id}.control"

    @staticmethod
    def __telemetry_topic(drone_id: str) -> str:
        return f"drone.{drone_id}.telemetry"
