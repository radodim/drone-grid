import asyncio
import contextlib
import logging

import aiohttp
from models import ControlMessage, Telemetry
from pydantic import ValidationError

from messaging.client import MessageHandler, MessagingClient

logger = logging.getLogger(__name__)

# TODO: add these to constructor with default values and consider externalizing to config.py
# Delay between reconnect attempts. A fixed delay is enough for now and is
# inherently flap-safe (it's always applied between attempts).
_RECONNECT_DELAY_S = 3.0
# ws-level ping/pong: detects a silently-dropped connection (NAT timeout, peer
# vanish without a close frame) and keeps NAT mappings warm on cellular links.
_HEARTBEAT_S = 15.0


class DroneGridMessagingClient(MessagingClient):
    """Backend messaging over a WebSocket, with transparent reconnection.

    A background connection loop owns the socket: it connects, runs the
    inbound reader, and on any disconnect reconnects after a fixed delay. The
    backend link is a separate failure domain from the flight-controller link,
    so a backend blip never disturbs the controller — the socket just
    reconnects underneath.

    Caller-facing behaviour:
      * publish_telemetry drops frames while disconnected (telemetry is
        ephemeral) instead of raising.
      * subscribe_control registers the handler once; the reader re-attaches
        it on every reconnect, so re-subscription is automatic.
      * frames received before a handler is set (e.g. during FC init) are
        read and dropped.
    """

    def __init__(self, url: str, drone_id: str, drone_secret: str) -> None:
        self.__url = url
        self.__auth = aiohttp.BasicAuth(drone_id, drone_secret)
        self.__session: aiohttp.ClientSession | None = None
        self.__ws: aiohttp.ClientWebSocketResponse | None = None
        self.__conn_task: asyncio.Task[None] | None = None
        self.__handler: MessageHandler[ControlMessage] | None = None

    async def __aenter__(self) -> "DroneGridMessagingClient":
        self.__session = aiohttp.ClientSession()
        self.__conn_task = asyncio.create_task(self.__connection_loop(self.__session))
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if self.__conn_task is not None:
            self.__conn_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self.__conn_task
            self.__conn_task = None
        # Closing the session closes the underlying websocket/connector too.
        if self.__session is not None:
            await self.__session.close()
            self.__session = None

    async def publish_telemetry(self, message: Telemetry) -> None:
        if self.__ws is None or self.__ws.closed:
            return
        try:
            await self.__ws.send_str(message.model_dump_json())
        except (ConnectionResetError, ConnectionError):
            pass  # Socket died mid-send; the connection loop will reconnect.

    async def subscribe_control(self, handler: MessageHandler[ControlMessage]) -> None:
        if self.__handler is not None:
            raise RuntimeError(
                "DroneGridMessagingClient supports only one subscription "
                "(the inbound control channel)."
            )
        # The reader reads __handler fresh each frame, so it re-attaches on the
        # current connection and every future reconnect — no re-subscribe call.
        self.__handler = handler

    async def __connection_loop(self, session: aiohttp.ClientSession) -> None:
        while True:
            try:
                self.__ws = await session.ws_connect(
                    self.__url, auth=self.__auth, heartbeat=_HEARTBEAT_S
                )
                logger.info(f"Connected to drone-grid messaging at {self.__url}")
                await self.__read_until_closed(self.__ws)
            except asyncio.CancelledError:
                raise
            except aiohttp.WSServerHandshakeError as e:
                log = (
                    logger.error if e.status in (401, 403) else logger.warning
                )  # TODO: fail on auth errors - they cannot be retried
                log(f"Messaging handshake failed ({e.status})")
            except Exception as e:
                logger.warning(f"Messaging connection lost: {e}")
            finally:
                self.__ws = None

            # TODO: implement a resilient retry policy (e.g. exponential backoff
            # with jitter) as the system scales — a fleet reconnecting in
            # lockstep after a backend restart would stampede it.
            await asyncio.sleep(_RECONNECT_DELAY_S)

    async def __read_until_closed(self, ws: aiohttp.ClientWebSocketResponse) -> None:
        # Reads inbound control frames and dispatches to the handler. Returns
        # (does not raise) on a close/error frame so the connection loop can
        # reconnect. Frames arriving before a handler is registered are dropped.
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                payload = msg.data.encode()
            elif msg.type == aiohttp.WSMsgType.BINARY:
                payload = msg.data
            else:
                logger.info(f"WebSocket frame type {msg.type} — connection closing")
                return

            handler = self.__handler
            if handler is None:
                continue  # not subscribed yet (e.g. during FC init) — drop

            try:
                model = ControlMessage.model_validate_json(payload)
            except ValidationError as e:
                logger.warning(f"Dropping invalid inbound message: {e}")
                continue
            try:
                await handler(model)
            except Exception:
                logger.exception("Handler raised on inbound message")
