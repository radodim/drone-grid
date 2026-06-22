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
journalctl -u drone-grid-companion -f
```

`install.sh` is idempotent — it installs uv + ffmpeg, syncs the 3.12 env, seeds
`/etc/drone-grid/companion.env` from the template (only if absent), and installs
+ enables the unit.

## Updating

```bash
cd ~/drone-grid && git pull
cd services/companion && uv sync --frozen
sudo systemctl restart drone-grid-companion
```

(Or just re-run `deploy/install.sh` — same effect; it won't touch your env file.)

## Pointing at a local dev stack (LAN, not prod)

To run the Pi's companion against the dev compose stack on another machine (e.g.
a Mac mini) on the same network. The dev stack serves **plain HTTP** (no TLS), so
the companion talks to it **by IP, bypassing Traefik** — no hostnames involved.

**Why not `api.localhost`?** Traefik routes by Host header (`Host(\`api.localhost\`)`),
so going *through* Traefik would need the companion to resolve `api.localhost` to
the dev box. That's impossible on a Linux Pi: modern glibc (≥2.33) hardcodes the
entire `.localhost` TLD to loopback *before* consulting `/etc/hosts`, so a hosts
entry can't redirect it. Instead, skip Traefik and hit the services directly —
which is exactly what the SITL `companion` container does (`ws://backend:8000/...`).

This needs the backend's port published on the dev box. In `compose.override.yaml`
the `backend` service has `ports: ["8000:8000"]` (dev-only). MediaMTX RTSP is
already published directly on `:8554`.

Find the dev box's LAN IP (`ipconfig getifaddr en0` on macOS), then set
`/etc/drone-grid/companion.env` (note `ws://` not `wss://`, explicit `:8000`,
and `secure=false`):

```bash
CONTROL__MESSAGING_URL=ws://192.168.0.14:8000/api/v1/companion
VIDEO__MEDIA_SERVER_URL=192.168.0.14:8554
VIDEO__SECURE=false
```

Verify reachability from the Pi: `curl http://192.168.0.14:8000/api/v1/health`
and `nc -vz 192.168.0.14 8554`.

(RTSP also stays direct because plain RTSP can't be host-routed through Traefik:
its TCP routing matches on `HostSNI`, which only exists in a TLS handshake —
routing media via Traefik would require RTSPS / `secure=true`, the prod path.)

Gotchas:
- **macOS firewall** (System Settings → Network → Firewall): if on, allow
  incoming connections or the Pi's requests time out. Most common failure.
- The `DRONE_ID`/`DRONE_SECRET` must be a drone provisioned in the dev backend.
  Don't run the SITL `companion` container and the Pi with the **same** ID
  simultaneously.
- `CONTROL__CONNECTION_URL` is the Pi's *local* FC link — it never points at the
  dev box. No FC yet? Drop the whole `CONTROL__*` block and run video-only
  (at least one subsystem is required).

## Flight controller link (Ethernet, point-to-point)

Pi `eth0` ↔ Pixhawk ETH port, direct cable, static IPs, no DHCP:
Pi = `10.41.10.1/24`, FC = `10.41.10.2/24`.

### Pi side — `/etc/netplan/01-network-manager-all.yaml`

```yaml
network:
  version: 2
  renderer: NetworkManager
  ethernets:
    eth0:
      dhcp4: false
      dhcp6: false
      optional: true
      addresses:
        - 10.41.10.1/24
```

No gateway on purpose — the FC link must never win the default route.
`optional: true` so boot doesn't block waiting on an unpowered FC.

```bash
sudo chmod 600 /etc/netplan/01-network-manager-all.yaml
sudo netplan try    # auto-rollback protects the wlan0 SSH session
ping 10.41.10.2
```

### FC side (nsh console)

Static IP — write `/fs/microsd/net.cfg`:

```
echo DEVICE=eth0 > /fs/microsd/net.cfg
echo BOOTPROTO=static >> /fs/microsd/net.cfg
echo IPADDR=10.41.10.2 >> /fs/microsd/net.cfg
echo NETMASK=255.255.255.0 >> /fs/microsd/net.cfg
echo ROUTER=10.41.10.254 >> /fs/microsd/net.cfg
echo DNS=10.41.10.254 >> /fs/microsd/net.cfg
```

MAVLink instance — static partner via extras.txt; the param-based
Ethernet instance must stay **disabled** (it would double-bind 14540):

```
param set MAV_2_CONFIG 0
param save
mkdir /fs/microsd/etc
echo "mavlink start -x -t 10.41.10.1 -u 14540 -r 100000 -f -m onboard -o 14540" > /fs/microsd/etc/extras.txt
reboot
```

### Why static partner + udpin (do NOT "simplify" this)

- `MAV_X_BROADCAST 1` fails on this NuttX build: `mavlink status` shows
  100% `txerr`, nothing leaves the FC.
- `udpout://` from the companion works **exactly once per FC boot**: PX4
  hands the partner slot to the first heartbeat's source port and never
  releases it, so a companion restart hangs in "Waiting to discover"
  until the FC reboots.
- `-t 10.41.10.1 -o 14540` + companion `udpin://0.0.0.0:14540` has no
  discovery state at all: PX4 pushes from boot, MAVSDK listens on and
  replies from the same port. Any restart order reconverges in ~1 s.
  This mirrors SITL exactly (`config/px4-sitl/px4-rc.mavlink` uses
  `-t 127.0.0.1`).

Companion env: `CONTROL__CONNECTION_URL=udpin://0.0.0.0:14540`

### Verify

- nsh `netman show` / `ifconfig` → eth0 UP with `10.41.10.2`
- nsh `mavlink status` → instance `UDP (14540, remote port: 14540)`,
  `tx:` non-zero, **`txerr: 0.0`**
- Pi: `ping 10.41.10.2`; companion logs "System discovered" within ~1 s —
  including immediately after a companion restart (the acceptance test).

## Operations

- Status: `systemctl status drone-grid-companion`
- Logs:   `journalctl -u drone-grid-companion -f`
- Stop:   `sudo systemctl stop drone-grid-companion`

systemd is the whole-process supervisor (`Restart=always`); the app's internal
loops handle subsystem (video/control) failures.
