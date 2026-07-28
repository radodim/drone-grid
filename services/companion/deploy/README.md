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

## Video service (mediamtx + WHIP)

On real hardware, video does **not** run inside the companion: a mediamtx
container owns the camera (`rpiCamera` source) and pushes WebRTC/WHIP to the
cloud via `runOnReady` ffmpeg. WebRTC abandons late packets instead of
retransmitting like RTSP-over-TCP, so video lag stays bounded on a lossy 4G
link. The companion runs control-only — **remove the whole `VIDEO__*` block
from `companion.env`** on the drone (two processes can't share the camera).
The companion's built-in pipeline remains for SITL and as rollback.

The image is built locally from `deploy/Dockerfile.video`: the stock
`bluenviron/mediamtx:1.18.1-ffmpeg-rpi` plus one static WHIP-capable ffmpeg at
`/usr/local/bin/ffmpeg-whip` (the image's apt ffmpeg 4.3.x predates the WHIP
muxer, which needs ffmpeg >= 8.0; base tag and ffmpeg URL + sha256 are pinned
in the Dockerfile).

- Camera settings (resolution, fps, bitrate, flips, focus) live in
  `/etc/drone-grid/mediamtx.yml` — not in `companion.env`.
- No secrets or per-drone values in the yml: the unit forwards
  `DRONE_ID`/`DRONE_SECRET`/`WHIP_URL` from `companion.env` into the container
  (`-e`), where the `runOnReady` shell expands them. Pointing at a dev stack is
  therefore just `WHIP_URL=http://<dev-box-ip>:8889` in `companion.env` — the
  yml never changes.
- Ops: `sudo systemctl start drone-grid-video` ·
  `journalctl -u drone-grid-video -f`
- Bench preview on the LAN, no cloud needed: `http://<pi-ip>:8889/cam`
- The on-Pi mediamtx is auth-open on the LAN (fine behind CGNAT/home NAT).
- Rollback: `sudo systemctl disable --now drone-grid-video`, restore the
  `VIDEO__*` block, `sudo systemctl restart drone-grid-companion`.

Boot chain: `docker.service` → `drone-grid-video.service` (foreground
`docker run`, `Restart=always`, logs in journald). The unit is deliberately
independent of `drone-grid-companion` — video keeps streaming when control is
down, which is exactly when you need eyes on the drone.

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

**If a 4G USB dongle is also installed:** the dongle presents as an ethernet
device, and a wildcard-matched profile will steal it. The fix is pinning the
FC-link connection to the board's MAC. The profile name varies by how it was
created (`netplan-fc-link` on the current drone) — discover it, then pin:

```bash
nmcli -f NAME,TYPE,DEVICE connection show     # find the FC-link profile name
sudo nmcli connection modify <profile> 802-3-ethernet.mac-address "$(cat /sys/class/net/eth0/address)"
```

**⚠ Pi board replacement (same SD card):** the MAC belongs to the *board*, not
the card — a swapped Pi has a new MAC, the pinned profile matches nothing, and
the FC link stays down (`nmcli device` shows eth0 disconnected; the stale MAC
is visible in `/etc/netplan/90-NM-*.yaml`). Re-run the `nmcli connection
modify` above (never hand-edit the 90-NM file — nmcli round-trips the change
into it), then `sudo nmcli connection up <profile>` and verify
`ping 10.41.10.2`. Everything else survives a board swap (it lives on the SD
card).

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

## Pi networking (netplan + NetworkManager)

The drone Pi runs three interfaces with strictly separated roles:

| Interface | Role | Config |
|---|---|---|
| `eth0` | FC link, point-to-point | static `10.41.10.1/24`, **no gateway**, MAC-pinned profile |
| `usb0` | WAN (4G USB dongle) | DHCP from the dongle; owns the default route in the field |
| `wlan0` | bench/backup WAN | ordinary WiFi profile |

### Who owns what (the part that bites)

Netplan does not manage the network at runtime — it *renders* config into
NetworkManager, which does. Two kinds of files live in `/etc/netplan/`:

- `01-network-manager-all.yaml` — ours, hand-written (the eth0 block above).
- `90-NM-<uuid>.yaml` — **generated by NetworkManager** for connections created
  via nmcli. Do not hand-edit these: NM rewrites them (a `connection.timestamp`
  appearing in the file is the tell that your edit was clobbered). Change NM
  connections with `nmcli connection modify`, never with an editor.

### The wildcard-match trap (why eth0 is MAC-pinned)

The 4G dongle presents as an *ethernet* device. A profile with an empty match
(`match: {}` — which netplan can generate) matches **any** ethernet interface,
so the eth0/FC profile can steal `usb0` when the dongle enumerates first —
the FC link config lands on the modem and both links break. The durable fix is
pinning the FC profile to the board's MAC (`802-3-ethernet.mac-address`, see
the FC-link section) — interface-name matching alone did not survive NM's
rewrites. Corollary: the pin must be re-stamped after a board swap.

### Routing policy

Only `usb0`/`wlan0` may own a default route (`eth0` has no gateway by design —
the FC link must never win). Lower route metric wins; check with:

```bash
ip route            # exactly one 'default via …' per active WAN, note metrics
nmcli -f NAME,DEVICE,TYPE connection show --active
```

If WiFi and 4G are both up and traffic prefers the wrong one, adjust with
`nmcli connection modify <name> ipv4.route-metric <n>` (lower = preferred).

### Recovery playbook

- `nmcli device` — the first command, always. Each device should show its
  intended profile; `disconnected` on eth0 after a board swap = stale MAC pin.
- Dongle dead / LED flashing but no traffic: `sudo nmcli device connect usb0`;
  if it attached to the wrong profile, check the wildcard trap above.
- 4G session wedged (huge RTT, video lag): power-cycle the dongle (replug or
  reboot) — it re-attaches to the tower with a clean session; restarting
  services does not touch the modem.
- After any change: `ping 10.41.10.2` (FC), `ping <backend>` (WAN), and
  `journalctl -u drone-grid-companion -f` for "System discovered".

## Operations

- Status: `systemctl status drone-grid-companion`
- Logs:   `journalctl -u drone-grid-companion -f`
- Stop:   `sudo systemctl stop drone-grid-companion`

systemd is the whole-process supervisor (`Restart=always`); the app's internal
loops handle subsystem (video/control) failures.

### Persistent logs across reboots (optional, recommended)

Raspberry Pi OS keeps the journal in RAM (`/run/log/journal`) — size-capped and
wiped on every reboot — so companion logs from past flights are gone exactly when
you want to debug them. Switch journald to disk-backed storage, bounded so it
can't eat the SD card:

```bash
sudo mkdir -p /var/log/journal /etc/systemd/journald.conf.d
sudo systemd-tmpfiles --create --prefix /var/log/journal   # fixes ownership/ACLs
sudo tee /etc/systemd/journald.conf.d/persist.conf > /dev/null <<'EOF'
[Journal]
Storage=persistent
SystemMaxUse=500M
SystemKeepFree=1G
MaxRetentionSec=60day
EOF
sudo systemctl restart systemd-journald
sudo journalctl --flush    # move the current boot's RAM logs to disk now
```

Verify: `journalctl --disk-usage` now reports usage in `/var/log/journal`, and
after the next reboot `journalctl --list-boots` lists more than one boot.

Reading a past flight:

```bash
journalctl --list-boots                                   # pick the flight's boot
journalctl -b -1 -u drone-grid-companion                  # previous boot
journalctl -u drone-grid-companion --since "2026-07-14"   # or by time window
```

Flash wear is a non-issue at this log volume: journald compresses, rotates within
the caps above, and batches non-critical writes (5 min sync interval).
