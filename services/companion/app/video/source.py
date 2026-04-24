from abc import ABC, abstractmethod


class VideoSource(ABC):
    """Produces an H.264 (Annex-B) byte stream on stdout.

    Concrete subclasses return the argv for a subprocess that, when its stdout
    is attached to a pipe, writes encoded H.264 frames continuously. Any setup
    the source needs (writing an SDP file, probing a device) should happen in
    build_command() before the command is returned.
    """

    @abstractmethod
    async def build_command(self) -> list[str]:
        pass
