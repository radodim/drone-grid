import base64
import logging

from app.models import ControlMessage, Telemetry
from pydantic import ValidationError
from websockets.asyncio.client import ClientConnection, connect
from websockets.exceptions import ConnectionClosed

from app.messaging.client import MessageHandler, MessagingClient

logger = logging.getLogger(__name__)


class DroneGridMessagingClient(MessagingClient):
    def __init__(
        self,
        url: str,
        drone_id: str,
        drone_secret: str,
        heartbeat_s: float = 15.0,
    ) -> None:
        self.__url = url
        token = base64.b64encode(f"{drone_id}:{drone_secret}".encode()).decode()
        self.__headers = {"Authorization": f"Basic {token}"}
        self.__heartbeat_s = heartbeat_s
        self.__ws: ClientConnection | None = None
        self.__handler: MessageHandler[ControlMessage] | None = None

    async def publish_telemetry(self, message: Telemetry) -> None:
        ws = self.__ws
        if ws is None:
            return
        try:
            await ws.send(message.model_dump_json())
        except ConnectionClosed:
            pass

    async def subscribe_control(self, handler: MessageHandler[ControlMessage]) -> None:
        if self.__handler is not None:
            raise RuntimeError(
                "DroneGridMessagingClient supports only one subscription "
                "(the inbound control channel)."
            )
        self.__handler = handler

    async def run(self) -> None:
        async for ws in connect(
            self.__url,
            additional_headers=self.__headers,
            ping_interval=self.__heartbeat_s,
        ):
            self.__ws = ws
            logger.info(f"Connected to drone-grid messaging at {self.__url}")
            try:
                async for raw in ws:
                    await self.__handle_inbound(raw)
            except ConnectionClosed:
                continue
            finally:
                self.__ws = None

    async def __handle_inbound(self, raw: str | bytes) -> None:
        handler = self.__handler
        if handler is None:
            return

        try:
            model = ControlMessage.model_validate_json(raw)
        except ValidationError as e:
            logger.warning(f"Dropping invalid inbound message: {e}")
            return

        try:
            await handler(model)
        except Exception:
            logger.exception("Handler raised on inbound message")
