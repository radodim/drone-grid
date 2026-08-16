#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OS_TYPE="$(uname)"

function main() {
    local LAN_IP; LAN_IP="$(get_lan_ip)"
    if [[ -z "${LAN_IP}" ]]; then
        echo "[ERROR] Could not determine the private IPv4 address of the host." >&2
        exit 1
    fi

    echo "[INFO] Media server will advertise the following WebRTC ICE candidate: ${LAN_IP}"

    export WEBRTC_ADDITIONAL_HOSTS="${LAN_IP}"
    export DEV_HOST; DEV_HOST="$(hostname -s | tr '[:upper:]' '[:lower:]').local"
    docker compose --project-directory "${REPO_ROOT}" up "$@"
}

function get_lan_ip() {
    case "${OS_TYPE}" in
        Linux) __get_lan_ip_linux ;;
        Darwin) __get_lan_ip_macos ;;
        *)
            echo "[ERROR] Unsupported OS: ${OS_TYPE}" >&2
            exit 1
            ;;
    esac
}

function __get_lan_ip_linux() {
    ip -4 route get 1.1.1.1 | grep -oP 'src \K[\d.]+'
}

function __get_lan_ip_macos() {
    local IFACE; IFACE="$(route -n get default | awk '/interface:/ {print $2}')"

    ipconfig getifaddr "${IFACE}"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
