# ── Dev stage: hot-reload via Vite dev server ──
FROM oven/bun:1 AS dev

WORKDIR /src

COPY package.json bun.lock* /src/

RUN bun install

COPY . /src/

CMD ["bun", "run", "dev", "--host", "0.0.0.0"]

# ── Build stage: compile static assets ──
FROM dev AS build

# VITE_ env vars are baked at build time — override via compose build.args in GitHub Workflow for production
ARG VITE_API_URL
ARG VITE_KEYCLOAK_URL
ARG VITE_KEYCLOAK_REALM
ARG VITE_KEYCLOAK_CLIENT_ID
ARG VITE_WEBRTC_URL

RUN bun run build

# ── Prod stage: serve via nginx ──
FROM nginx:alpine

COPY --from=build /src/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
