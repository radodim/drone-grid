from abc import ABC, abstractmethod


class VideoProcess(ABC):
    @abstractmethod
    def build_command(self) -> list[str]:
        pass
