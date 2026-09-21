FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/observability/package.json packages/observability/package.json

RUN pnpm install --frozen-lockfile

COPY apps/worker apps/worker
COPY packages/shared packages/shared
COPY packages/database packages/database
COPY packages/observability packages/observability

RUN pnpm --filter @tms/worker... build

CMD ["node", "apps/worker/dist/main.js"]
