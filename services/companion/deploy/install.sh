#!/bin/bash

set -euo pipefail

COMPANION_DIR="$(realpath "$(dirname "${BASH_SOURCE[0]}")/..")"
RUN_USER="$(whoami)"
ENV_FILE="/etc/drone-grid/companion.env"
SYSTEMD_UNIT_DEST="/etc/systemd/system/drone-grid-companion.service"
VIDEO_IMAGE_TAG="drone-grid-video:1.18.1"
MEDIAMTX_CONFIG="/etc/drone-grid/mediamtx.yml"
VIDEO_UNIT_DEST="/etc/systemd/system/drone-grid-video.service"

function main() {
    echo "[INFO] Companion dir: ${COMPANION_DIR}"
    echo "[INFO] Service user: ${RUN_USER}"

    install_uv
    install_libs
    sync_python_env
    create_env_file
    install_systemd_unit
    install_docker
    build_video_image
    create_mediamtx_config
    configure_video_sysctl
    install_video_unit
    print_next_steps
}

function install_uv() {
    __ensure_uv_supported_os
    if ! command -v uv >/dev/null; then
        echo "[INFO] Installing uv..."
        curl -LsSf 'https://astral.sh/uv/install.sh' | sh
        # shellcheck disable=SC1091
        source "${HOME}/.local/bin/env"
    fi
}

function __ensure_uv_supported_os() {
    if [[ "$(uname -m)" != "aarch64" ]]; then
        echo "[ERROR] uv expects a 64-bit OS (aarch64); got '$(uname -m)'." >&2
        exit 1
    fi
}

function install_libs() {
    echo "[INFO] Updating packages..."
    sudo apt-get update -qq

    echo "[INFO] Installing ffmpeg..."
    sudo apt-get install -y --no-install-recommends ffmpeg
}

function sync_python_env() {
    echo "[INFO] Syncing Python environment (managed 3.12)..."
    (cd "${COMPANION_DIR}" && uv sync --frozen)
}

function create_env_file() {
    # Created once from the template, never overwritten — re-runs keep secrets.
    if [[ -f "${ENV_FILE}" ]]; then
        echo "[INFO] ${ENV_FILE} exists — leaving it untouched."
        return
    fi
    echo "[INFO] Creating ${ENV_FILE} from template — EDIT IT with real values."
    sudo install -d -m 755 /etc/drone-grid
    sudo install -m 600 -o root -g root \
        "${COMPANION_DIR}/deploy/companion.env.example" "${ENV_FILE}"
}

function install_systemd_unit() {
    echo "[INFO] Installing systemd unit..."
    sed -e "s|__COMPANION_DIR__|${COMPANION_DIR}|g" -e "s|__RUN_USER__|${RUN_USER}|g" \
        "${COMPANION_DIR}/deploy/drone-grid-companion.service" \
        | sudo tee "${SYSTEMD_UNIT_DEST}" >/dev/null
    sudo systemctl daemon-reload
    sudo systemctl enable drone-grid-companion
}

function install_docker() {
    if ! command -v docker >/dev/null; then
        echo "[INFO] Installing Docker..."
        curl -fsSL 'https://get.docker.com' | sh
    fi
}

function build_video_image() {
    echo "[INFO] Building video image ${VIDEO_IMAGE_TAG}..."
    sudo docker build -f "${COMPANION_DIR}/deploy/Dockerfile.video" \
        -t "${VIDEO_IMAGE_TAG}" "${COMPANION_DIR}/deploy"
}

function create_mediamtx_config() {
    # Created once from the template, never overwritten — re-runs keep edits.
    if [[ -f "${MEDIAMTX_CONFIG}" ]]; then
        echo "[INFO] ${MEDIAMTX_CONFIG} exists — leaving it untouched."
        return
    fi
    echo "[INFO] Creating ${MEDIAMTX_CONFIG} from template."
    sudo install -d -m 755 /etc/drone-grid
    sudo install -m 644 -o root -g root \
        "${COMPANION_DIR}/deploy/mediamtx.yml.example" "${MEDIAMTX_CONFIG}"
}

function configure_video_sysctl() {
    # The kernel clamps SO_SNDBUF requests to net.core.wmem_max (~208 KB
    # default) — too small for the WHIP publisher's IDR bursts (EAGAIN).
    echo "[INFO] Raising net.core.wmem_max for the WHIP publisher..."
    echo 'net.core.wmem_max=8388608' \
        | sudo tee /etc/sysctl.d/99-drone-grid.conf >/dev/null
    sudo sysctl --system >/dev/null
}

function install_video_unit() {
    echo "[INFO] Installing video systemd unit..."
    sudo install -m 644 -o root -g root \
        "${COMPANION_DIR}/deploy/drone-grid-video.service" "${VIDEO_UNIT_DEST}"
    sudo systemctl daemon-reload
    sudo systemctl enable drone-grid-video
}

function print_next_steps() {
    echo
    echo "[INFO] Done. Next steps:"
    echo "  1. Edit secrets within the file: ${ENV_FILE}"
    echo "  2. Start control: sudo systemctl start drone-grid-companion"
    echo "  3. Start video: sudo systemctl start drone-grid-video"
    echo "  4. Logs: journalctl -u drone-grid-companion -f (or -u drone-grid-video)"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main
fi
