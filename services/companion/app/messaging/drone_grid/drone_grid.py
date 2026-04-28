import asyncio
import logging

import aiohttp
from pydantic import BaseModel, ValidationError

from messaging.client import M, MessageHandler, MessagingClient

logger = logging.getLogger(__name__)


# TODO: Implement reconnect strategy
class DroneGridMessagingClient(MessagingClient):
    """WebSocket client speaking the drone-grid backend's /api/v1/companion
    protocol.

    Unlike NATS — a general pub/sub broker with arbitrary subjects — this
    protocol exposes exactly two channels per drone connection: outgoing
    telemetry and incoming control. Topic strings are informational. Every
    `publish` goes out as telemetry; every received frame is dispatched to
    the single `subscribe` handler. Calling `subscribe` twice raises, since
    there's only one inbound channel to register against.

    HTTP Basic Auth (drone_id as username, drone_secret as password) is
    applied at the WebSocket handshake.
    """

    def __init__(self, url: str, drone_id: str, drone_secret: str) -> None:
        self._url = url
        self._auth = aiohttp.BasicAuth(drone_id, drone_secret)
        self._session: aiohttp.ClientSession | None = None
        self._ws: aiohttp.ClientWebSocketResponse | None = (
            None  # TODO: Refactor so initialization happens here, no need to check if _ws everywhere
        )
        self._reader_task: asyncio.Task[None] | None = None
        self._handler: tuple[type[BaseModel], MessageHandler] | None = None

    async def __aenter__(self) -> "DroneGridMessagingClient":
        self._session = aiohttp.ClientSession()
        self._ws = await self._session.ws_connect(self._url, auth=self._auth)
        logger.info(f"Connected to drone-grid messaging at {self._url}")
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if self._reader_task is not None:
            self._reader_task.cancel()
            try:
                await self._reader_task
            except asyncio.CancelledError:
                pass
            self._reader_task = None
        if self._ws is not None:
            await self._ws.close()
            self._ws = None
        if self._session is not None:
            await self._session.close()
            self._session = None

    async def publish(
        self, topic: str, message: BaseModel
    ) -> None:  # TODO: remove the topic concept since messaging system is not exposed
        if self._ws is None:
            raise RuntimeError("Messaging client is not connected")
        # Topic is informational — the WS connection is implicitly the
        # drone.<id>.telemetry channel from the backend's perspective.
        await self._ws.send_str(message.model_dump_json())

    async def subscribe(
        self,
        topic: str,
        model_type: type[M],
        handler: MessageHandler[M],
    ) -> None:
        if self._ws is None:
            raise RuntimeError("Messaging client is not connected")
        if self._handler is not None:
            raise RuntimeError(
                "DroneGridMessagingClient supports only one subscription "
                "(the inbound control channel)."
            )
        self._handler = (model_type, handler)
        self._reader_task = asyncio.create_task(self._reader_loop())

    async def _reader_loop(self) -> None:
        # Loop receives frames from the backend's control channel, parses
        # each into the registered model, and invokes the handler. Loops
        # exit on close/error frames or task cancellation in __aexit__.
        assert self._ws is not None and self._handler is not None
        model_type, handler = self._handler
        async for msg in self._ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                payload = msg.data.encode()
            elif msg.type == aiohttp.WSMsgType.BINARY:
                payload = msg.data
            else:
                logger.info(f"WebSocket frame type {msg.type} — closing reader loop")
                break
            try:
                model = model_type.model_validate_json(payload)
            except ValidationError as e:
                logger.warning(f"Dropping invalid inbound message: {e}")
                continue
            try:
                await handler(model)
            except Exception:
                logger.exception("Handler raised on inbound message")
