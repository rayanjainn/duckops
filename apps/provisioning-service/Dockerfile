# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/provisioning-service/package.json ./apps/provisioning-service/
COPY packages/db/package.json ./packages/db/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY apps/provisioning-service ./apps/provisioning-service
COPY packages ./packages

RUN cd packages/db && pnpm prisma generate
RUN pnpm turbo build --filter=provisioning-service

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm deploy --filter=provisioning-service --prod /deploy && \
    mkdir -p /deploy/node_modules/.prisma && \
    cp -r packages/db/src/generated/client /deploy/node_modules/.prisma/client && \
    cp -r apps/provisioning-service/src/templates /deploy/dist/templates

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

RUN apk add --no-cache git
RUN addgroup -S duckops && adduser -S duckops -G duckops
WORKDIR /app

COPY --from=builder /deploy ./
RUN mkdir -p /tmp/duckops-projects && chown -R duckops:duckops /app /tmp/duckops-projects
USER duckops

EXPOSE 4002
CMD ["node", "dist/index.js"]
