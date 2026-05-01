import asyncio
import logging

import aiohttp
from models import ControlMessage, Telemetry
from pydantic import ValidationError

from messaging.client import MessageHandler, MessagingClient

logger = logging.getLogger(__name__)


# TODO: Implement reconnect strategy
class DroneGridMessagingClient(MessagingClient):
    def __init__(self, url: str, drone_id: str, drone_secret: str) -> None:
        self._url = url
        self._auth = aiohttp.BasicAuth(drone_id, drone_secret)
        self._session: aiohttp.ClientSession | None = None
        self._ws: aiohttp.ClientWebSocketResponse | None = None
        self._reader_task: asyncio.Task[None] | None = None
        self._handler: MessageHandler[ControlMessage] | None = None

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

    async def publish_telemetry(self, message: Telemetry) -> None:
        if self._ws is None:
            raise RuntimeError("Messaging client is not connected")
        await self._ws.send_str(message.model_dump_json())

    async def subscribe_control(self, handler: MessageHandler[ControlMessage]) -> None:
        if self._ws is None:
            raise RuntimeError("Messaging client is not connected")
        if self._handler is not None:
            raise RuntimeError(
                "DroneGridMessagingClient supports only one subscription "
                "(the inbound control channel)."
            )
        self._handler = handler
        self._reader_task = asyncio.create_task(self._reader_loop())

    async def _reader_loop(self) -> None:
        # Loop receives frames from the backend's control channel, parses
        # each into a ControlMessage, and invokes the handler. Loops exit
        # on close/error frames or task cancellation in __aexit__.
        assert self._ws is not None and self._handler is not None
        handler = self._handler
        async for msg in self._ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                payload = msg.data.encode()
            elif msg.type == aiohttp.WSMsgType.BINARY:
                payload = msg.data
            else:
                logger.info(f"WebSocket frame type {msg.type} — closing reader loop")
                break
            try:
                model = ControlMessage.model_validate_json(payload)
            except ValidationError as e:
                logger.warning(f"Dropping invalid inbound message: {e}")
                continue
            try:
                await handler(model)
            except Exception:
                logger.exception("Handler raised on inbound message")
