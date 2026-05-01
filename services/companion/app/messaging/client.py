from abc import ABC, abstractmethod
from typing import Awaitable, Callable, TypeVar

from models import ControlMessage, Telemetry
from pydantic import BaseModel

M = TypeVar("M", bound=BaseModel)

MessageHandler = Callable[[M], Awaitable[None]]


class MessagingClient(ABC):
    @abstractmethod
    async def __aenter__(self) -> "MessagingClient": ...

    @abstractmethod
    async def __aexit__(self, exc_type, exc, tb) -> None: ...

    @abstractmethod
    async def publish_telemetry(self, message: Telemetry) -> None: ...

    @abstractmethod
    async def subscribe_control(
        self, handler: MessageHandler[ControlMessage]
    ) -> None: ...
