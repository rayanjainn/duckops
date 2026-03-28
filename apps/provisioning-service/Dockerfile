FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/provisioning-service ./apps/provisioning-service
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN cd packages/db && pnpm prisma generate
RUN pnpm turbo build --filter=provisioning-service

FROM node:22-alpine

RUN apk add --no-cache git
RUN npm install -g pnpm

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/provisioning-service/package.json ./apps/provisioning-service/
COPY --from=builder /app/apps/provisioning-service/dist ./apps/provisioning-service/dist
COPY --from=builder /app/apps/provisioning-service/src/templates ./apps/provisioning-service/dist/templates

RUN pnpm install --frozen-lockfile --prod

EXPOSE 4002

CMD ["node", "apps/provisioning-service/dist/index.js"]
