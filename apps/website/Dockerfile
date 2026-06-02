FROM node:24-alpine AS build

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/website/package.json apps/website/package.json
COPY packages/client/package.json packages/client/package.json
COPY packages/cloudflare/package.json packages/cloudflare/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN corepack enable && pnpm install --frozen-lockfile

COPY apps/website apps/website

RUN pnpm --filter @renewlet/website build

FROM nginx:1.29-alpine

COPY apps/website/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/website/dist /usr/share/nginx/html
