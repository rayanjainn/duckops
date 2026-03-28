FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/web ./apps/web
COPY packages/shared-types ./packages/shared-types

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=web

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
