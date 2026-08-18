# Drone Grid — Web UI

The browser cockpit: drone management, live WebRTC video, telemetry HUD,
and manual control. Built with [Vite](https://vitejs.dev/),
[React](https://react.dev/), TypeScript,
[TanStack Query](https://tanstack.com/query) +
[Router](https://tanstack.com/router), and Tailwind CSS. In production the
build is served by nginx; `public/` serves (landing page, `terms.txt`
/ `privacy.txt`, `.well-known/`).
How it fits into the whole system: [architecture](https://docs.drone-grid.com/architecture/).

## Development

The local development shell script (`bash scripts/run_drone_grid.sh` from the repo root) already
runs the Vite dev server with hot reload — `src/` and `public/` are
bind-mounted, so edits apply live at `http://<HOSTNAME>.local`.

For host-side tooling, install [Bun](https://bun.sh/):

```bash
bun install
bun run lint    # biome, writes fixes
bun test src    # unit tests
bun run build   # typecheck + production build
```
## Generated API client

`src/client/` is generated from the backend's OpenAPI schema — it shouldn't be edited by hand. After changing backend endpoints:

```bash
bash scripts/generate-client.sh   # from the repo root; needs uv + bun
```

