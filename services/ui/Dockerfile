# ── Dev stage: hot-reload via Vite dev server ──
FROM oven/bun:1 AS dev

WORKDIR /src

COPY package.json bun.lock* /src/

RUN bun install

COPY . /src/

CMD ["bun", "run", "dev", "--host", "0.0.0.0"]

# ── Build stage: compile static assets ──
FROM dev AS build

RUN bun run build

# ── Prod stage: serve via nginx ──
FROM nginx:alpine

COPY --from=build /src/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
