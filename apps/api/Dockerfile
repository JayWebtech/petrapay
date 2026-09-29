# Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm install --frozen-lockfile --filter @petrapay/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @petrapay/api build

FROM node:22-alpine
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
EXPOSE 4000
# Apply pending migrations, then start the API and status worker.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
