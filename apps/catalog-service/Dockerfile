# syntax=docker/dockerfile:1.7
# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Enable BuildKit cache mount for pnpm store (massive speedup on rebuilds)
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy manifests first so pnpm install is cached until lockfile changes
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/catalog-service/package.json ./apps/catalog-service/
COPY packages/db/package.json ./packages/db/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source after deps so source changes don't bust the dep cache
COPY apps/catalog-service ./apps/catalog-service
COPY packages ./packages

RUN cd packages/db && pnpm prisma generate
RUN pnpm turbo build --filter=catalog-service

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Create non-root user
RUN addgroup -S duckops && adduser -S duckops -G duckops

WORKDIR /app

# Copy only what's needed to run
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/catalog-service/package.json ./apps/catalog-service/
COPY --from=builder /app/apps/catalog-service/dist ./apps/catalog-service/dist

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod && \
    cd packages/db && pnpm prisma generate

RUN chown -R duckops:duckops /app
USER duckops

EXPOSE 4001

CMD ["node", "apps/catalog-service/dist/index.js"]
