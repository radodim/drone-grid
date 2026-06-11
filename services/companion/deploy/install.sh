#!/bin/bash

set -euo pipefail

COMPANION_DIR="$(realpath "$(dirname "${BASH_SOURCE[0]}")/..")"
RUN_USER="$(whoami)"
ENV_FILE="/etc/drone-grid/companion.env"
SYSTEMD_UNIT_DEST="/etc/systemd/system/drone-grid-companion.service"

function main() {
    echo "[INFO] Companion dir: ${COMPANION_DIR}"
    echo "[INFO] Service user: ${RUN_USER}"

    install_uv
    install_libs
    sync_python_env
    create_env_file
    install_systemd_unit
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

function print_next_steps() {
    echo
    echo "[INFO] Done. Next steps:"
    echo "  1. Edit secrets within the file: ${ENV_FILE}"
    echo "  2. How to start: sudo systemctl start drone-grid-companion"
    echo "  3. How to get logs: journalctl -u drone-grid-companion -f"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main
fi
