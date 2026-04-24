# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/catalog-service/package.json ./apps/catalog-service/
COPY packages/db/package.json ./packages/db/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY apps/catalog-service ./apps/catalog-service
COPY packages ./packages

RUN cd packages/db && pnpm prisma generate
RUN pnpm turbo build --filter=catalog-service

# pnpm deploy: flat prod-only node_modules, no .pnpm store, no workspace files.
# Cuts runtime image by ~50% vs copying the full workspace node_modules.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm deploy --legacy --filter=catalog-service --prod /deploy && \
    mkdir -p /deploy/node_modules/.prisma && \
    cp -r packages/db/src/generated/client /deploy/node_modules/.prisma/client

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

RUN addgroup -S duckops && adduser -S duckops -G duckops
WORKDIR /app

COPY --from=builder /deploy ./
RUN chown -R duckops:duckops /app
USER duckops

EXPOSE 4001
CMD ["node", "dist/index.js"]
