FROM oven/bun:1

WORKDIR /src

COPY package.json bun.lock* /src/

RUN bun install

COPY . /src/

CMD ["bun", "run", "dev", "--host", "0.0.0.0"]
