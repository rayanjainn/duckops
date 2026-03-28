FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/catalog-service ./apps/catalog-service
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN cd packages/db && pnpm prisma generate
RUN pnpm turbo build --filter=catalog-service

FROM node:22-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/catalog-service/package.json ./apps/catalog-service/
COPY --from=builder /app/apps/catalog-service/dist ./apps/catalog-service/dist

RUN pnpm install --frozen-lockfile --prod

EXPOSE 4001

CMD ["node", "apps/catalog-service/dist/index.js"]
