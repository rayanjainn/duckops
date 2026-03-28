FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/pipeline-service ./apps/pipeline-service
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN cd packages/db && pnpm prisma generate
RUN pnpm turbo build --filter=pipeline-service

FROM node:22-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/pipeline-service/package.json ./apps/pipeline-service/
COPY --from=builder /app/apps/pipeline-service/dist ./apps/pipeline-service/dist

RUN pnpm install --frozen-lockfile --prod

EXPOSE 4003

CMD ["node", "apps/pipeline-service/dist/index.js"]
