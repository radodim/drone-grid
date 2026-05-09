FROM python:3.12

ENV PYTHONUNBUFFERED=1

# Install uv
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#installing-uv
COPY --from=ghcr.io/astral-sh/uv:0.9.26 /uv /uvx /bin/

# ffmpeg drives both the Gazebo video source (UDP/RTP → raw H.264) and the
# RTSP / WHIP publishers. WHIP requires ffmpeg ≥ 8.0 — Debian Bookworm only
# packages 5.1.x, so we install a static build from BtbN/FFmpeg-Builds (LGPL
# v3 variant; build pipeline maintained by FFmpeg core dev Timo Rothenpieler
# and linked from ffmpeg.org/download.html). License text retained at
# /usr/local/share/ffmpeg-LICENSE.txt.
ARG TARGETARCH
ARG FFMPEG_BUILD=autobuild-2026-05-03-13-13
ARG FFMPEG_VERSION=n8.1-11-g75d37c499d
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl xz-utils ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && ARCH=$([ "$TARGETARCH" = "arm64" ] && echo "linuxarm64" || echo "linux64") \
    && TARBALL="ffmpeg-${FFMPEG_VERSION}-${ARCH}-lgpl-8.1.tar.xz" \
    && curl -fsSL "https://github.com/BtbN/FFmpeg-Builds/releases/download/${FFMPEG_BUILD}/${TARBALL}" -o /tmp/ffmpeg.tar.xz \
    && tar -xJf /tmp/ffmpeg.tar.xz -C /tmp \
    && EXTRACTED="/tmp/ffmpeg-${FFMPEG_VERSION}-${ARCH}-lgpl-8.1" \
    && install -m 0755 "${EXTRACTED}/bin/ffmpeg" /usr/local/bin/ffmpeg \
    && install -m 0755 "${EXTRACTED}/bin/ffprobe" /usr/local/bin/ffprobe \
    && install -m 0644 "${EXTRACTED}/LICENSE.txt" /usr/local/share/ffmpeg-LICENSE.txt \
    && rm -rf /tmp/ffmpeg.tar.xz "${EXTRACTED}"

# Compile bytecode
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#compiling-bytecode
ENV UV_COMPILE_BYTECODE=1

# uv Cache
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#caching
ENV UV_LINK_MODE=copy

WORKDIR /src/

# Place executables in the environment at the front of the path
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#using-the-environment
ENV PATH="/src/.venv/bin:$PATH"

# Install dependencies
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#intermediate-layers
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-workspace

COPY ./pyproject.toml /src/

COPY ./app /src/app

# Sync the project
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#intermediate-layers
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen

CMD ["python", "app/main.py"]
