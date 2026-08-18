# Drone Grid — Companion

The onboard agent that links the drone to a Drone Grid instance. It runs
next to the flight controller (Raspberry Pi in the reference build), communicates with it over MAVLink via [MAVSDK](https://mavsdk.mavlink.io/), and connects
*outward* to the instance over authenticated WebSockets using the per-drone
credentials minted in the UI (`DRONE_ID` / `DRONE_SECRET`) — no inbound
ports on the drone. A separate video service pushes the camera feed to the
instance's WebRTC gateway (mediamtx).
How it fits into the whole system: [architecture](https://docs.drone-grid.com/architecture/).

## Development (no aircraft required)

The companion can fly a **PX4 SITL** simulator instead of real hardware:
uncomment the `px4-sitl` + `companion` blocks in `compose.override.yaml`,
set the credentials of a drone you created in the UI, and restart the local
stack. Docker is for simulation only — real Pis run the systemd services
from `deploy/`.

Dependencies are managed with [uv](https://docs.astral.sh/uv/) on
Python 3.12 (`uv sync`).

## Real hardware

Follow the
[companion setup guide](https://docs.drone-grid.com/hardware/x650-raspberry-pi/companion-setup/)
— wiring, networking configuration, camera, and operations — with `deploy/README.md` as the reference.
