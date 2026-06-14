# Event hub (the long-running, keyed round runner + SSE + research/oracle endpoints).
# Deploy to a process host (Railway / Render / Fly). Secrets are injected as env vars by the host —
# never baked into the image. The hub reads PORT from the host and binds to it.
FROM oven/bun:1.3

WORKDIR /app

# Install workspace deps (layer-cached on package manifests).
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY packages/agents/package.json packages/agents/
COPY packages/web/package.json packages/web/
RUN bun install

# App source. .dockerignore keeps out node_modules, .next, contracts/lib, etc.
COPY . .

ENV NODE_ENV=production
# Recommended production guards (override per host):
ENV REQUIRE_GRANT=true
ENV MIN_ROUND_INTERVAL_MS=60000

EXPOSE 8787
CMD ["bun", "run", "packages/agents/src/eventServer.ts"]
