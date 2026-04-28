from abc import abstractmethod
from contextlib import AbstractAsyncContextManager
from typing import Annotated, Awaitable, Callable, TypeVar

from fastapi import Depends
from pydantic import BaseModel
from starlette.requests import HTTPConnection

from app.data.control.model.message import ControlMessage
from app.data.telemetry.model.telemetry import Telemetry

M = TypeVar("M", bound=BaseModel)
MessageHandler = Callable[[M], Awaitable[None]]


class Subscription(AbstractAsyncContextManager["Subscription"]):
    """A live broker subscription scoped to an `async with` block.

    Entering registers the subscription with the broker; exiting tears it
    down. Lifecycle is intentionally lexical — every subscription in the
    backend today lives inside one WebSocket handler — which means callers
    don't need an explicit `unsubscribe()` and can't forget to call it.

    `__aenter__` is re-declared as abstract here to override the default
    no-op inherited from AbstractAsyncContextManager — every subscription
    needs to actively register with the broker, never silently skip it.
    """

    @abstractmethod
    async def __aenter__(self) -> "Subscription": ...


class MessagingService(AbstractAsyncContextManager["MessagingService"]):
    """Abstract publish/subscribe service for the drone control plane.

    Payloads are Pydantic models, never bytes. Concrete implementations own
    wire-format conversion (JSON today, possibly msgpack later) so callers
    never touch serialization. Topic naming conventions also live inside
    the implementation — callers identify drones by id, not subject.

    Lifecycle is managed via the async-context-manager protocol. Broker
    connections are opened in __aenter__ and drained in __aexit__, mirroring
    the companion's MessagingClient.

    `__aenter__` is re-declared as abstract here to override the default
    no-op inherited from AbstractAsyncContextManager — every implementation
    needs to actively connect, never silently skip the broker handshake.
    """

    @abstractmethod
    async def __aenter__(self) -> "MessagingService": ...

    @abstractmethod
    async def publish_control(self, drone_id: str, message: ControlMessage) -> None: ...

    @abstractmethod
    async def publish_telemetry(self, drone_id: str, message: Telemetry) -> None: ...

    @abstractmethod
    def subscribe_control(
        self, drone_id: str, handler: MessageHandler[ControlMessage]
    ) -> Subscription:
        """Returns a not-yet-active subscription. Activate with `async with`;
        the broker subscribe call happens in the context manager's __aenter__."""

    @abstractmethod
    def subscribe_telemetry(
        self, drone_id: str, handler: MessageHandler[Telemetry]
    ) -> Subscription:
        """Returns a not-yet-active subscription. Activate with `async with`;
        the broker subscribe call happens in the context manager's __aenter__."""


def __get_messaging_service(conn: HTTPConnection) -> MessagingService:
    return conn.app.state.messaging


MessagingServiceDep = Annotated[MessagingService, Depends(__get_messaging_service)]
