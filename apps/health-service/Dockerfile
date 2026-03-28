FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/health-service ./apps/health-service
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN cd packages/db && pnpm prisma generate
RUN pnpm turbo build --filter=health-service

FROM node:22-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/health-service/package.json ./apps/health-service/
COPY --from=builder /app/apps/health-service/dist ./apps/health-service/dist

RUN pnpm install --frozen-lockfile --prod

EXPOSE 4004

CMD ["node", "apps/health-service/dist/index.js"]
