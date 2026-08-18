# Drone Grid — Backend

The control plane: REST API for users, drones, and share links. 
Bridge for the messaging system (relaying telemetry and control between
browsers and companions) and for the media server (authorizing every stream
publish/read and serving stream links via the MediaMTX control API).
How it fits into the whole system: [architecture](https://docs.drone-grid.com/architecture/).

## Development

Runs as part of the local stack (`bash scripts/run_drone_grid.sh` from the
repo root) with hot reload — `app/` is mounted into the container.
Dependencies are managed with [uv](https://docs.astral.sh/uv/) (`uv sync`
for a local venv).

After changing endpoints or schemas, regenerate the UI's API client:
`bash scripts/generate-client.sh` from the repo root.
