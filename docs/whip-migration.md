# WHIP video migration — runbook

Replace the companion's RTSP-over-TCP video publishing with a mediamtx container on
the Pi (rpiCamera source + `runOnReady` ffmpeg WHIP push). Motivation: TCP
retransmission over 4G accumulates unbounded lag; WebRTC abandons late packets and
the decoder recovers at the next IDR.

**Hard orderings:** #1 deploys before #8 (else the WHIP push 401-loops) ·
`VIDEO__*` removed from `companion.env` before the container starts (camera is
single-user) · everything else is parallelizable.

**Rollback (available at every step until #11):** disable the video unit, restore
the `VIDEO__*` block in `/etc/drone-grid/companion.env`, restart the companion.

## #1 — Backend: accept WebRTC publish in `media_auth`

Relax the protocol pin at `services/backend/app/api/routes/media.py:30` to:

```python
if body.protocol in ("rtsp", "webrtc") and body.action == "publish":
```

Keep `rtsp` during migration (it's the rollback path). Deploy to prod **before**
the Pi cutover.

Auth flow (verified): ffmpeg sends `Authorization: Bearer <drone_id>:<drone_secret>`
via the WHIP muxer's `-authorization` option; mediamtx splits colon-concatenated
Bearer values into `user`/`password` in the auth-hook body, so
`__validate_drone_publish` works unchanged. Do NOT pass credentials as query
params — Traefik access logs record query strings.

## #2 — Add `deploy/mediamtx.yml.example` template

New `services/companion/deploy/mediamtx.yml.example`:

```yaml
rtmp: no
hls: no
srt: no

paths:
  cam:
    source: rpiCamera
    rpiCameraWidth: 1280
    rpiCameraHeight: 960
    rpiCameraFPS: 30
    rpiCameraBitrate: 5000000
    rpiCameraVFlip: true
    rpiCameraHFlip: true
    rpiCameraAfMode: manual
    rpiCameraIDRPeriod: 12
    runOnReady: >
      ffmpeg -i rtsp://localhost:8554/cam
      -f lavfi -i anullsrc=r=48000:cl=stereo
      -c:v copy -c:a libopus -b:a 16k
      -f whip -authorization "__DRONE_ID__:__DRONE_SECRET__"
      https://webrtc.drone-grid.com/__DRONE_ID__/whip
    runOnReadyRestart: yes
```

RTSP stays on (localhost read for `runOnReady`); WebRTC stays on (LAN bench
preview). The silent Opus track satisfies FFmpeg 8.0's both-tracks requirement and
is harmless on 7.1. Settings mirror the previous companion config: 1280×960 (4:3 —
native aspect for Cam v2, full FoV), 30 fps, 5 Mbps, manual focus, IDR period 12
(matches the old `--intra 12`).

## #3 — Add `drone-grid-video.service` systemd unit

`services/companion/deploy/drone-grid-video.service`:

```ini
[Unit]
Description=Drone Grid video (mediamtx rpiCamera + WHIP publisher)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
ExecStartPre=-/usr/bin/docker rm -f drone-grid-video
ExecStart=/usr/bin/docker run --rm --name drone-grid-video \
  --network=host \
  --privileged \
  --tmpfs /dev/shm:exec \
  -v /run/udev:/run/udev:ro \
  -v /etc/drone-grid/mediamtx.yml:/mediamtx.yml:ro \
  bluenviron/mediamtx:<pinned>-ffmpeg-rpi
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

- Foreground `docker run` → logs flow into journald (`journalctl -u
  drone-grid-video`, covered by the persistent journal).
- No Docker restart policy — systemd is the single supervisor.
- `ExecStartPre` sweeps orphaned containers after hard power cuts.
- **Do not order against `drone-grid-companion`** — independence is deliberate
  (video is the diagnostic when control is dead). The UI fails safe in the
  video-up/telemetry-down window (arm disabled, "companion not ready").

## #4 — Extend `install.sh`

Idempotent additions, existing bash style (shellcheck-clean, `${VAR}`, `[[ ]]`,
dunder helpers, main guard):

- Install Docker if absent (`curl -fsSL https://get.docker.com | sh` — enables
  `docker.service` at boot)
- `docker pull` the pinned `-ffmpeg-rpi` image
- Seed `/etc/drone-grid/mediamtx.yml` only-if-absent: substitute
  `__DRONE_ID__`/`__DRONE_SECRET__` from `companion.env`; root-owned, `chmod 600`
  (the secret lives in this file too)
- Install + `systemctl enable drone-grid-video`

## #5 — Document in deploy README

New section: architecture (container owns camera + WHIP push; companion is
control-only on real hardware), boot chain (`docker.service` → unit →
`Restart=always`), ops commands, LAN preview `http://<pi>:8889/cam`, camera config
now lives in `/etc/drone-grid/mediamtx.yml`, note the Pi's mediamtx is auth-open on
the LAN (fine behind CGNAT), and the rollback procedure.

## #6 — Verify UI during the video-up/telemetry-down window

On SITL or bench: player mounts and plays while the drone state shows
stale/connecting; arm stays disabled ("companion not ready"); no toast spam. Also
the reverse (telemetry up, video down): error toasts don't loop.

Expected result: confirmation only, no new code — the reader mounts unconditionally
(`drones_.$droneId.tsx`) and `useDroneState` fails safe.

## #7 — Bench gate: image ffmpeg supports WHIP (go/no-go for everything)

```bash
docker run --rm --entrypoint ffmpeg bluenviron/mediamtx:<pinned>-ffmpeg-rpi -h muxer=whip
```

Must show the muxer and its `-authorization` option. Fallback if missing: derived
Dockerfile (`FROM <tag>-rpi` + pinned static ffmpeg), or SRT as plan B.

## #8 — Pi cutover

```bash
# 1. backend (#1) already deployed
# 2. free the camera:
sudo nano /etc/drone-grid/companion.env      # remove the VIDEO__* block
sudo systemctl restart drone-grid-companion  # now control-only
# 3. deploy:
cd ~/drone-grid && git pull
./services/companion/deploy/install.sh
sudo systemctl start drone-grid-video
# 4. verify:
journalctl -u drone-grid-video -f
# LAN preview http://<pi-lan-ip>:8889/cam → picture, aspect, focus
# then: live video + telemetry in the drone-grid UI
```

If focus is wrong on the bench, set `rpiCameraLensPosition` (0.0 = infinity).

## #9 — Acceptance test: bounded lag under impairment

The criterion the migration exists for. While streaming over 4G:

```bash
sudo tc qdisc add dev usb0 root netem loss 3% delay 80ms 20ms
```

Film a stopwatch; confirm glass-to-glass lag stays bounded and recovers within ~an
IDR (0.4 s). Run the same impairment against the old RTSPS path for before/after
evidence. Clean up: `sudo tc qdisc del dev usb0 root`.

## #10 — Flight test

Real flight over 4G: latency behavior on RF dips (old failure mode: lag ratchets
and never drains), reboot recovery (unit + `runOnReadyRestart`), no
control/telemetry regression. Rollback if needed per the standing procedure.

## #11 — Post-cutover cleanup (after the flight passes)

- Drop `"rtsp"` from the `media_auth` publish check (WHIP-only)
- Delete `RpicamVideoSource` + its factory branch and config fields (prod-dead;
  Gazebo/SITL path stays)
- Update `companion.env.example` (`VIDEO__*` becomes SITL-only/removed; pointer to
  `mediamtx.yml`)
- Consider `record: yes` + `recordDeleteAfter` in `mediamtx.yml` — on-SD flight
  recordings for free (landing-page footage, post-flight review)
