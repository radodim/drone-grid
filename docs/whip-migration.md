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
      /usr/local/bin/ffmpeg-whip
      -fflags nobuffer -probesize 32768
      -i rtsp://localhost:8554/cam
      -c:v copy
      -f whip -ts_buffer_size 1000000
      -authorization "$DRONE_ID:$DRONE_SECRET"
      "$WHIP_URL/$DRONE_ID/whip"
    runOnReadyRestart: yes
```

Command tuning (bench-derived, 2026-07-23):
- **Video-only** — needs ffmpeg 8.1+ (8.0 mandates an audio track: add back
  `-f lavfi -i anullsrc=r=48000:cl=stereo` + `-c:a libopus -b:a 16k` if ever
  downgraded). An audio track also makes browsers delay video behind the audio
  jitter buffer (~100 ms of glass-to-glass) — dropping it is a latency win,
  not just cleanup.
- **`-fflags nobuffer -probesize 32768`** — cap input probing at ~32 KB
  (≈50 ms of stream; safe because codec params come from the RTSP SDP) and
  discard the probed packets instead of replaying them, starting at the live
  edge. Paid per session start, so it speeds up every `runOnReadyRestart`
  recovery. Bench-measured (Pi 3B, 2026-07-23, `pkill ffmpeg-whip` respawns):
  probe 1138 ms → 161–236 ms; full respawn-to-live 2311 ms → 1314–1478 ms,
  now dominated by a fixed ~1.0 s DTLS-handshake timer inside ffmpeg's WHIP
  implementation (not tunable from our side). NOTE: `-analyzeduration 0`
  from common low-latency recipes is inert — 0 is libavformat's "unset"
  sentinel and resolves to the 5 s default; probesize is the binding cap.
  (`-flags low_delay` from the legacy publisher was dropped: it only affects
  decoders, and this pipeline is pure `-c copy` — it was always inert.)
- **`-ts_buffer_size` 1 MB** — sizes the WHIP UDP send buffer (default ~4 KB
  dies on the first IDR burst: ~100–200 KB every 0.4 s → EAGAIN → fatal).
  1 MB holds ~5 keyframe bursts yet bounds buffer-induced lag to ~1.6 s at
  5 Mbps; a longer link stall trips EAGAIN → clean restart instead of a
  zombie stream dragging seconds of backlog. Requires `net.core.wmem_max`
  raised (kernel silently clamps requests to ~208 KB otherwise):
  `/etc/sysctl.d/99-drone-grid.conf` → `net.core.wmem_max=8388608`.

No substitution at all: `runOnReady` runs through a shell that inherits the
container env, so `$WHIP_URL`/`$DRONE_ID`/`$DRONE_SECRET` expand at spawn time
from the `-e` passthrough in the unit (#3). The template ships verbatim;
`companion.env` stays the single source of secrets AND the publish target
(`WHIP_URL=https://webrtc.drone-grid.com` in prod,
`http://<dev-box-ip>:8889` for a LAN dev stack — the yml never changes). `/usr/local/bin/ffmpeg-whip` is the static
ffmpeg added by `Dockerfile.video` (#7) — absolute path, no PATH ambiguity with
the stock 4.3.9.

RTSP stays on (localhost read for `runOnReady`); WebRTC stays on (LAN bench
preview). The silent Opus track satisfies FFmpeg 8.0's both-tracks requirement
(8.1 relaxed it; keep it for version-proofing). Settings mirror the previous
companion config: 1280×960 (4:3 — native aspect for Cam v2, full FoV), 30 fps,
5 Mbps, manual focus, IDR period 12 (matches the old `--intra 12`).

## #3 — Add `drone-grid-video.service` systemd unit

`services/companion/deploy/drone-grid-video.service`:

```ini
[Unit]
Description=Drone Grid video (mediamtx rpiCamera + WHIP publisher)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=/etc/drone-grid/companion.env
ExecStartPre=-/usr/bin/docker rm -f drone-grid-video
ExecStart=/usr/bin/docker run --rm --name drone-grid-video \
  --network=host \
  --privileged \
  --tmpfs /dev/shm:exec \
  -v /run/udev:/run/udev:ro \
  -v /etc/drone-grid/mediamtx.yml:/mediamtx.yml:ro \
  -e DRONE_ID -e DRONE_SECRET -e WHIP_URL \
  drone-grid-video:1.18.1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

`-e VAR` with no value forwards from the unit's environment (loaded from
`companion.env`) into the container, where the `runOnReady` shell expands it.
The image is the locally-built `drone-grid-video:1.18.1` (see #7), not a
registry tag.

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
- `docker build -f Dockerfile.video -t drone-grid-video:1.18.1 .` (idempotent —
  layer-cached; base tag + ffmpeg URL/sha256 pinned in the Dockerfile)
- Seed `/etc/drone-grid/mediamtx.yml` only-if-absent, verbatim copy of the
  template (no secrets in it — they arrive via env passthrough at runtime)
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

## #7 — Bench gate: image ffmpeg supports WHIP — RESOLVED (custom image)

Gate result (2026-07-22): **stock images NO-GO.** Both `1.17.1-ffmpeg-rpi` and
`1.18.1-ffmpeg-rpi` bundle apt ffmpeg `4.3.9` (RPi OS Bullseye userland). The
WHIP muxer shipped in ffmpeg **8.0** (not 7.1 as earlier drafts claimed) and is
never backported, so no Debian-packaged ffmpeg has it — official mediamtx images
can't support WHIP until Debian ships ffmpeg 8.

Resolution: `services/companion/deploy/Dockerfile.video` — multi-stage build,
`FROM bluenviron/mediamtx:1.18.1-ffmpeg-rpi` + one static BtbN ffmpeg
(`n8.1.2-29`, **lgpl** — no H.264 encoder, publish leg is `-c copy`; dated
autobuild tag + sha256 pinned) copied to `/usr/local/bin/ffmpeg-whip`. The
validated image is otherwise byte-for-byte intact.

Verified on arm64 (Mac, 2026-07-22): image builds; `ffmpeg-whip -h muxer=whip`
shows the muxer + `-authorization`; stock `/usr/bin/ffmpeg` untouched. Cloud
mediamtx stays pinned `1.17.1` — no version coupling (WHIP is a standard
protocol); the Pi yml schema tracks the Pi image's version (`1.18.1`).

lgpl caveat for Tier-1 (Mac) smoke tests: `ffmpeg-whip` cannot encode H.264 —
generate the test pattern with another ffmpeg (brew's, or the stock 4.3.9 in the
image) and let `ffmpeg-whip` do the `-c copy` → WHIP leg, which matches the real
pipeline shape anyway.

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

The criterion the migration exists for. While streaming, impair the uplink
(`usb0` = 4G on the drone, `wlan0` on a WiFi bench Pi):

```bash
sudo tc qdisc add dev usb0 root netem loss 3% delay 80ms 20ms
# cleanup:
sudo tc qdisc del dev usb0 root
```

Film a stopwatch; confirm glass-to-glass lag stays bounded and recovers within ~an
IDR (0.4 s). Run the same impairment against the old RTSPS path for before/after
evidence.

**Why this one test demonstrates WebRTC > RTSPS-over-TCP for live piloting:**
under random loss, TCP's throughput ceiling is ≈ MSS / (RTT × √loss) (Mathis) —
at 100 ms RTT and 3% loss that's ~0.7 Mbps, far under the 5 Mbps stream, so
TCP *cannot* carry it: retransmissions of already-stale frames consume the link,
head-of-line blocking holds fresh frames behind lost ones, nothing in the chain
drops, and lag ratchets seconds-per-second with no recovery path. WebRTC applies
retransmission *with a deadline* (NACK/RTX only while a packet can still arrive
in time), abandons what expired, and heals at the next IDR — the same impairment
costs a bounded few-hundred-ms plateau that recovers when the link does (worst
case a clean ~5 s session restart via `runOnReadyRestart`). Pilot-view frames
expire in ~200 ms; a transport that guarantees delivery of expired data converts
loss into unbounded lag, which is the failure mode this migration removes.

**Bench result — PASSED (2026-07-23; Pi 3B → Mac mini dev stack over 2.4 GHz
WiFi; netem `loss 3% delay 80ms 20ms`; 1280×960@30, 5 Mbps; glass-to-glass
stopwatch, ms):**

| Timeline                  | RTSPS (TCP) | WHIP |
|---------------------------|-------------|------|
| Baseline (clean link)     | 232         | 233  |
| Impaired +10 s            | 9143        | 3027 |
| Impaired +30 s            | 10939       | 1625 |
| Recovery reading 1 (~60 s)| 8240        | 361  |
| Recovery reading 2 (~90 s)| 2617        | 175  |

Reading: parity on a clean link (the transport is free when nothing is lost);
under impairment RTSPS ratchets to ~11 s and is still ~35× baseline half a
minute *after* the link healed (TCP backlog drains only at surplus bandwidth),
while WHIP bounds at ~3 s — the send buffer + jitter buffer absorbing the worst
— improves *during* the impairment as expired data is abandoned, and returns to
baseline within ~30 s of recovery. WHIP's ~3 s worst-case transient is the
`-ts_buffer_size` trade-off dial: smaller bounds it tighter at the cost of more
circuit-breaker restarts.

## #10 — Flight test

Real flight over 4G: latency behavior on RF dips (old failure mode: lag ratchets
and never drains), reboot recovery (unit + `runOnReadyRestart`), no
control/telemetry regression. Rollback if needed per the standing procedure.

## Deferred follow-ups (explicitly not blocking the flight)

- **Glitch-to-picture budget (~8–9 s observed in the UI)** decomposes as:
  ~5 s mediamtx `runOnReady` restart pause + ~1.4 s ffmpeg respawn (measured,
  DTLS-floored) + 0–2 s viewer retry (`retryPause = 2000`,
  `services/ui/src/lib/mediamtx-reader.js:37`) + ~1 s WHEP setup + ≤0.4 s IDR.
  Biggest lever: wrap the runOnReady ffmpeg in a `sh -c 'while true; do
  ffmpeg ...; sleep 1; done'` supervisor loop to bypass the 5 s pause
  (mediamtx kills commands as a process group, so path teardown still stops
  the loop). Second lever: reader `retryPause` 2000 → 1000. Expected combined:
  ~4–5 s.
- **`rpiCameraLensPosition` for the Cam 3 drone**: mediamtx manual-AF defaults
  to infinity; the legacy pipeline used hyperfocal (`--lens-position default`).
  `rpiCameraLensPosition: 1.0` approximates hyperfocal — judge sharpness on the
  bench preview at cutover.
- **H.264 Main profile playback on the tablet**: mediamtx encodes Main (legacy
  pipeline forced baseline); verified in Chrome — confirm once on iPadOS
  Safari, the pickiest WebRTC decoder in the fleet.
- **Pi 5 note**: rpicam `--low-latency` has no mediamtx equivalent; irrelevant
  on hw-encoder Pis (3B/4), revisit if a Pi 5 (software encode) joins.

## #11 — Post-cutover cleanup (after the flight passes)

- Drop `"rtsp"` from the `media_auth` publish check (WHIP-only)
- Delete `RpicamVideoSource` + its factory branch and config fields (prod-dead;
  Gazebo/SITL path stays)
- Update `companion.env.example` (`VIDEO__*` becomes SITL-only/removed; pointer to
  `mediamtx.yml`)
- Consider `record: yes` + `recordDeleteAfter` in `mediamtx.yml` — on-SD flight
  recordings for free (landing-page footage, post-flight review)
