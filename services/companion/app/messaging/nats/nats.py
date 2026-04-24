import logging

from nats.aio.client import Client as NatsClient
from nats.aio.msg import Msg as NatsMsg
from pydantic import BaseModel, ValidationError

from messaging.client import M, MessageHandler, MessagingClient

logger = logging.getLogger(__name__)


class NatsMessagingClient(MessagingClient):
    def __init__(self, url: str) -> None:
        self._url = url
        # Constructed unconnected. The actual network connection opens in
        # __aenter__ so lifecycle is explicit at the caller site.
        self._client = NatsClient()

    async def __aenter__(self) -> "NatsMessagingClient":
        await self._client.connect(servers=[self._url])
        logger.info(f"Connected to NATS at {self._url}")
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self._client.drain()

    async def publish(self, topic: str, message: BaseModel) -> None:
        await self._client.publish(topic, message.model_dump_json().encode())

    async def subscribe(
        self,
        topic: str,
        model_type: type[M],
        handler: MessageHandler[M],
    ) -> None:
        # Adapter from NATS's library-native Msg callback to our typed
        # handler. Invalid payloads are logged and dropped — they're
        # almost always schema drift (a producer changed the shape), not
        # anything the handler can recover from in-flight.
        async def _deliver(msg: NatsMsg) -> None:
            try:
                model = model_type.model_validate_json(msg.data)
            except ValidationError as e:
                logger.warning(f"Dropping invalid message on {topic}: {e}")
                return
            await handler(model)

        await self._client.subscribe(topic, cb=_deliver)
