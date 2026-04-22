# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY apps/web ./apps/web
COPY packages/shared-types ./packages/shared-types

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo build --filter=web

# ─── Runtime: Next.js standalone output — no node_modules needed ──────────────
FROM node:22-alpine AS runtime

RUN addgroup -S duckops && adduser -S duckops -G duckops
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# standalone bundle includes its own trimmed node_modules (~10x smaller than full install)
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

RUN chown -R duckops:duckops /app
USER duckops

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
