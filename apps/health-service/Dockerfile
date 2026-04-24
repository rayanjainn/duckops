# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/health-service/package.json ./apps/health-service/
COPY packages/db/package.json ./packages/db/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY apps/health-service ./apps/health-service
COPY packages ./packages

RUN cd packages/db && pnpm prisma generate
RUN pnpm turbo build --filter=health-service

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm deploy --legacy --filter=health-service --prod /deploy && \
    mkdir -p /deploy/node_modules/.prisma && \
    cp -r packages/db/src/generated/client /deploy/node_modules/.prisma/client

# ─── kubectl binary (pinned, single layer, no curl left in image) ─────────────
FROM node:22-alpine AS kubectl-dl
RUN apk add --no-cache curl && \
    KUBECTL_VER=$(curl -fsSL https://dl.k8s.io/release/stable.txt) && \
    curl -fsSL "https://dl.k8s.io/release/${KUBECTL_VER}/bin/linux/amd64/kubectl" \
         -o /kubectl && chmod +x /kubectl

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

COPY --from=kubectl-dl /kubectl /usr/local/bin/kubectl
WORKDIR /app

COPY --from=builder /deploy ./

EXPOSE 4004
CMD ["node", "dist/index.js"]
