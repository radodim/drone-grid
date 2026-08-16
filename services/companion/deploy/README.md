# Companion deployment (Raspberry Pi)

The companion runs as a **systemd service** on the Pi. Code ships via `git`,
config/secrets via a local env file. (Docker/compose in this repo is the
SITL simulator only — not the Pi.)

## Prerequisites

- **64-bit Raspberry Pi OS** (`uname -m` → `aarch64`). 32-bit is unsupported:
  uv has no managed Python 3.12 build for it. The Pi's default Python (3.14)
  is irrelevant — uv provisions its own **3.12** (pinned via `.python-version`),
  matching the version the project is developed and tested on.
- Camera enabled, and the service user in the `video` group
  (`sudo usermod -aG video "$USER"`; usually already true for `pi`).
- Working clock (`timedatectl` — NTP synced), or the `wss://` TLS handshake
  to the backend can fail.

## First-time setup

```bash
# 1. Deploy key (read-only) so the Pi can pull this private repo:
ssh-keygen -t ed25519 -f ~/.ssh/drone-grid -N ""
cat ~/.ssh/drone-grid.pub      # add as a READ-ONLY Deploy Key in the repo settings
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/drone-grid
EOF

# 2. Clone and install:
git clone git@github.com:radodim/drone-grid.git
./drone-grid/services/companion/deploy/install.sh

# 3. Fill in secrets, then start:
sudo nano /etc/drone-grid/companion.env    # DRONE_ID, DRONE_SECRET, URLs...
sudo systemctl start drone-grid-companion
sudo systemctl start drone-grid-video
journalctl -u drone-grid-companion -f
```

`install.sh` is idempotent — it installs uv + ffmpeg + Docker, syncs the 3.12
env, seeds `/etc/drone-grid/companion.env` and `/etc/drone-grid/mediamtx.yml`
from the templates (only if absent), builds the video image, and installs +
enables both units.

## Updating

```bash
cd ~/drone-grid && git pull
cd services/companion && uv sync --frozen
sudo systemctl restart drone-grid-companion
```

(Or just re-run `deploy/install.sh` — same effect; it won't touch your env file.)

## Full manual

Everything else lives in the documentation site (published at
<https://docs.drone-grid.com>, sources in `docs/`):

- [Companion install & operations](../../../docs/content/hardware/x650-raspberry-pi/companion-setup.md#companion-install)
  — pointing at a LAN dev stack, persistent journald logs, ops commands
- [Flight controller link](../../../docs/content/hardware/x650-raspberry-pi/companion-setup.md#flight-controller-link)
  — Pi ↔ Pixhawk Ethernet, netplan + nsh config, verification
- [Camera & video](../../../docs/content/hardware/x650-raspberry-pi/companion-setup.md#camera--video)
  — the mediamtx + WHIP video service, camera settings, rollback
