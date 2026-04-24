import asyncio
import logging
import os

from video.publisher import VideoPublisher
from video.source import VideoSource

logger = logging.getLogger(__name__)


class VideoPipeline:
    """Wires a VideoSource's stdout into a VideoPublisher's stdin via an OS
    pipe and supervises both subprocess lifecycles.

    The two subprocesses talk through the kernel pipe directly — Python never
    copies bytes in userspace — which keeps CPU overhead on the Pi minimal.
    """

    def __init__(self, source: VideoSource, publisher: VideoPublisher) -> None:
        self._source = source
        self._publisher = publisher
        self._source_proc: asyncio.subprocess.Process | None = None
        self._publisher_proc: asyncio.subprocess.Process | None = None

    async def start(self) -> None:
        src_cmd = await self._source.build_command()
        pub_cmd = await self._publisher.build_command()

        # Unix pipes reference-count each end. The write end stays "open"
        # as long as any process holds its fd; the reader won't see EOF
        # until everyone has closed it. So: spawn the source child with
        # write_fd as its stdout (child inherits the fd), then close
        # write_fd in the parent immediately — now only the source child
        # holds the write end. When source exits, EOF propagates to the
        # publisher and ffmpeg shuts down cleanly instead of hanging on
        # stdin. Same logic for read_fd on the publisher side.
        read_fd, write_fd = os.pipe()
        try:
            self._source_proc = await asyncio.create_subprocess_exec(
                *src_cmd,
                stdin=asyncio.subprocess.DEVNULL,
                stdout=write_fd,
                stderr=asyncio.subprocess.PIPE,
            )
        except BaseException:
            os.close(read_fd)
            os.close(write_fd)
            raise
        os.close(write_fd)

        try:
            self._publisher_proc = await asyncio.create_subprocess_exec(
                *pub_cmd,
                stdin=read_fd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )
        except BaseException:
            os.close(read_fd)
            self._source_proc.terminate()
            await self._source_proc.wait()
            raise
        os.close(read_fd)

        logger.info(
            f"Video pipeline started: source pid={self._source_proc.pid}, "
            f"publisher pid={self._publisher_proc.pid}"
        )

    async def stop(self) -> None:
        # Stop the publisher first so it flushes any buffered frames before
        # losing its upstream.
        for name, proc in (
            ("publisher", self._publisher_proc),
            ("source", self._source_proc),
        ):
            if proc is None or proc.returncode is not None:
                continue
            logger.info(f"Terminating video {name} (pid={proc.pid})")
            proc.terminate()
            try:
                await asyncio.wait_for(proc.wait(), timeout=5)
            except asyncio.TimeoutError:
                logger.warning(f"Video {name} did not terminate; killing")
                proc.kill()
                await proc.wait()

    async def __aenter__(self) -> "VideoPipeline":
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.stop()
