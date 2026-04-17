# syntax=docker/dockerfile:1.7
# ─── Build stage ─────────────────────────────────────────────────────────────
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

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

# git is required for repo operations (init, push)
RUN apk add --no-cache git

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

RUN addgroup -S duckops && adduser -S duckops -G duckops

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/provisioning-service/package.json ./apps/provisioning-service/
COPY --from=builder /app/apps/provisioning-service/dist ./apps/provisioning-service/dist
# Templates are loaded at runtime from dist/templates
COPY --from=builder /app/apps/provisioning-service/src/templates ./apps/provisioning-service/dist/templates

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod && \
    cd packages/db && pnpm prisma generate

# /tmp/duckops-projects is where scaffolded code is written — must be writable
RUN mkdir -p /tmp/duckops-projects && chown -R duckops:duckops /app /tmp/duckops-projects
USER duckops

EXPOSE 4002

CMD ["node", "apps/provisioning-service/dist/index.js"]
