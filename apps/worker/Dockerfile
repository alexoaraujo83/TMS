FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json apps/worker/package.json

RUN pnpm install --frozen-lockfile

COPY apps/worker apps/worker

RUN pnpm --filter @tms/worker build

CMD ["node", "apps/worker/dist/main.js"]
