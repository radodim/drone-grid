# Companion deployment (Raspberry Pi)

The companion runs as a **systemd service** on the Pi. Code ships via `git`,
config/secrets via a local env file. (Docker/compose in this repo is the
SITL simulator only — not the Pi.)

## Prerequisites

- **64-bit Raspberry Pi OS** (`uname -m` → `aarch64`). 32-bit is unsupported:
  uv has no managed Python 3.12 build for it. The Pi's default Python (3.14)
  is irrelevant — uv provisions its own **3.12** (pinned via `.python-version`),
  matching the version the project is developed and tested on. Flashing
  walkthrough: [companion setup guide](../../../docs/content/hardware/x650-raspberry-pi/companion-setup.md#flashing-the-sd-card-with-raspberry-pi-os-lite-64-bit-trixie-134).
- Camera enabled, and the service user in the `video` group
  (`sudo usermod -aG video "$USER"`; usually already true for `pi`).
- Working clock (`timedatectl` — NTP synced), or the `wss://` TLS handshake
  to the backend can fail.

## First-time setup

The same steps with full context (drone credentials, video and control
verification) live in the [companion setup guide](../../../docs/content/hardware/x650-raspberry-pi/companion-setup.md#configuring-the-companion-with-the-utility-script).

```bash
# 1. Clone and install:
git clone https://github.com/radodim/drone-grid.git
./drone-grid/services/companion/deploy/install.sh

# 2. Fill in secrets, then start:
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

- [Companion configuration](../../../docs/content/hardware/x650-raspberry-pi/companion-setup.md#configuring-the-companion-with-the-utility-script)
  — install script, credentials, env file
- [Video service test](../../../docs/content/hardware/x650-raspberry-pi/companion-setup.md#video-systemd-service-test)
  — verifying the live feed end to end
- [Control configuration](../../../docs/content/hardware/x650-raspberry-pi/companion-setup.md#control-configuration-and-test)
  — Pi ↔ Pixhawk Ethernet, netplan, verification
- [Mobile uplink](../../../docs/content/hardware/x650-raspberry-pi/companion-setup.md#5g4g-modem-connection)
  — 4G/5G modem and hotspot notes
- [Persistent journald logs](../../../docs/content/hardware/x650-raspberry-pi/companion-setup.md#enabling-persistent-journalctl-logs-by-default-they-are-only-in-ram)
  — keeping flight logs across reboots
