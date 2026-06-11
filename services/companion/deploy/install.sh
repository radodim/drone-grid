#!/usr/bin/env bash
# One-time companion setup on a 64-bit Raspberry Pi OS host.
# Run as the unprivileged user that will own the service (NOT with sudo —
# the script sudo's only the steps that need root). Idempotent: safe to
# re-run, e.g. after a `git pull`.
set -euo pipefail

COMPANION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_USER="$(whoami)"
ENV_FILE="/etc/drone-grid/companion.env"
UNIT_DEST="/etc/systemd/system/drone-grid-companion.service"

if [ "$(uname -m)" != "aarch64" ]; then
  echo "ERROR: this expects 64-bit Pi OS (aarch64); got '$(uname -m)'." >&2
  echo "uv has no managed Python 3.12 for 32-bit — reimage to 64-bit." >&2
  exit 1
fi

echo "Companion dir: $COMPANION_DIR"
echo "Service user:  $RUN_USER"

# 1. uv (provisions managed Python 3.12 per .python-version)
if ! command -v uv >/dev/null 2>&1; then
  echo "==> Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

# 2. system deps — ffmpeg drives the RTSP publish (rpicam-vid ships with Pi OS)
echo "==> Installing ffmpeg..."
sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends ffmpeg

# 3. Python 3.12 env + locked deps
echo "==> Syncing Python environment (managed 3.12)..."
(cd "$COMPANION_DIR" && uv sync --frozen)

# 4. secrets/config — created once from the template, never overwritten
if [ ! -f "$ENV_FILE" ]; then
  echo "==> Creating $ENV_FILE from template — EDIT IT with real values."
  sudo install -d -m 755 /etc/drone-grid
  sudo install -m 600 -o root -g root \
    "$COMPANION_DIR/deploy/companion.env.example" "$ENV_FILE"
fi

# 5. systemd unit (paths/user substituted in)
echo "==> Installing systemd unit..."
sed -e "s|__COMPANION_DIR__|$COMPANION_DIR|g" -e "s|__RUN_USER__|$RUN_USER|g" \
  "$COMPANION_DIR/deploy/drone-grid-companion.service" \
  | sudo tee "$UNIT_DEST" >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable drone-grid-companion

echo
echo "Done."
echo "  1. Edit secrets:  sudo nano $ENV_FILE"
echo "  2. Start:         sudo systemctl start drone-grid-companion"
echo "  3. Logs:          journalctl -u drone-grid-companion -f"
