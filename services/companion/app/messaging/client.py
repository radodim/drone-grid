from abc import ABC, abstractmethod
from typing import Awaitable, Callable, TypeVar

from pydantic import BaseModel

M = TypeVar("M", bound=BaseModel)

MessageHandler = Callable[[M], Awaitable[None]]


class MessagingClient(ABC):
    """Abstract publish/subscribe client.

    Payloads are Pydantic models — concrete implementations own wire-format
    conversion so callers never touch bytes or JSON directly. Topics are
    strings; topic naming conventions (e.g. drone.<id>.control) live with
    the caller, not the client.

    Lifecycle is managed via the async-context-manager protocol. Broker
    connections are opened in __aenter__ and drained in __aexit__.
    """

    @abstractmethod
    async def __aenter__(self) -> "MessagingClient": ...

    @abstractmethod
    async def __aexit__(self, exc_type, exc, tb) -> None: ...

    @abstractmethod
    async def publish(self, topic: str, message: BaseModel) -> None: ...

    @abstractmethod
    async def subscribe(
        self,
        topic: str,
        model_type: type[M],
        handler: MessageHandler[M],
    ) -> None: ...
