import asyncio
import logging
import os
from collections.abc import Callable

from app.video.process import VideoProcess

logger = logging.getLogger(__name__)


class VideoPipeline:
    def __init__(self, source: VideoProcess, publisher: VideoProcess) -> None:
        self.__source = source
        self.__publisher = publisher
        self.__source_proc: asyncio.subprocess.Process | None = None
        self.__publisher_proc: asyncio.subprocess.Process | None = None

    async def start(self) -> None:
        if self.__source_proc is not None or self.__publisher_proc is not None:
            raise RuntimeError("VideoPipeline.start() called more than once")

        source_command = self.__source.build_command()
        publisher_command = self.__publisher.build_command()
        read_fd, write_fd = os.pipe()
        try:
            self.__source_proc = await self.__start_source(source_command, write_fd)
            self.__publisher_proc = await self.__start_publisher(
                publisher_command, read_fd
            )
        finally:
            os.close(read_fd)
            os.close(write_fd)

        logger.info(
            f"Video pipeline started: source pid={self.__source_proc.pid}, "
            f"publisher pid={self.__publisher_proc.pid}"
        )

    async def __start_source(
        self, source_command: list[str], stdout_fd: int
    ) -> asyncio.subprocess.Process:
        return await asyncio.create_subprocess_exec(
            *source_command,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=stdout_fd,
            stderr=asyncio.subprocess.DEVNULL,
        )

    async def __start_publisher(
        self, publisher_command: list[str], stdin_fd: int
    ) -> asyncio.subprocess.Process:
        return await asyncio.create_subprocess_exec(
            *publisher_command,
            stdin=stdin_fd,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )

    async def wait_for_exit(self) -> None:
        if self.__source_proc is None or self.__publisher_proc is None:
            raise RuntimeError("VideoPipeline.wait_for_exit() called before start()")

        waiters = [
            asyncio.ensure_future(self.__source_proc.wait()),
            asyncio.ensure_future(self.__publisher_proc.wait()),
        ]
        try:
            await asyncio.wait(waiters, return_when=asyncio.FIRST_COMPLETED)
        finally:
            for waiter in waiters:
                waiter.cancel()
            await asyncio.gather(*waiters, return_exceptions=True)

    async def stop(self) -> None:
        await self.__stop_process("publisher", self.__publisher_proc, timeout=5)
        await self.__stop_process("source", self.__source_proc, timeout=5)

    async def __stop_process(
        self, name: str, proc: asyncio.subprocess.Process | None, timeout: float
    ) -> None:
        if proc is None or proc.returncode is not None:
            return

        logger.info(f"Terminating video {name} (pid={proc.pid})...")
        self.__send_signal(proc.terminate)
        if await self.__wait_exited(proc, timeout):
            return

        logger.warning(f"Video {name} did not terminate. Killing the process...")
        self.__send_signal(proc.kill)
        if not await self.__wait_exited(proc, timeout):
            logger.error(
                f"Video process with name '{name}' and PID '{proc.pid}' did not exit after SIGKILL."
            )

    @staticmethod
    def __send_signal(proc_func: Callable[[], None]) -> None:
        try:
            proc_func()
        except ProcessLookupError:
            pass

    @staticmethod
    async def __wait_exited(proc: asyncio.subprocess.Process, timeout: float) -> bool:
        try:
            await asyncio.wait_for(proc.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            return False
