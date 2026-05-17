# syntax=docker/dockerfile:1.7

FROM --platform=$BUILDPLATFORM node:24-alpine AS client-deps

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/client/package.json packages/client/package.json
COPY packages/server/package.json packages/server/package.json
RUN pnpm install --frozen-lockfile

FROM client-deps AS client-builder
COPY packages/client packages/client
RUN pnpm --filter @renewlet/client build

FROM --platform=$BUILDPLATFORM golang:1.26.2-alpine AS server-builder

ARG TARGETOS=linux
ARG TARGETARCH

WORKDIR /src/packages/server

COPY packages/server/go.mod packages/server/go.sum ./
RUN go mod download

COPY packages/server ./
RUN mkdir -p internal/static/public \
  && find internal/static/public -mindepth 1 ! -name .gitkeep -delete
COPY --from=client-builder /app/packages/client/dist ./internal/static/public

RUN mkdir -p /out /pb_data \
  && CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-$(go env GOARCH)} go build -trimpath -ldflags="-s -w" -o /out/renewlet ./cmd/renewlet

FROM gcr.io/distroless/static-debian13:nonroot AS runner

ENV GOMEMLIMIT=128MiB

COPY --from=server-builder --chown=nonroot:nonroot /pb_data /pb_data
COPY --from=server-builder /out/renewlet /renewlet

VOLUME ["/pb_data"]
EXPOSE 3000

USER nonroot:nonroot
ENTRYPOINT ["/renewlet"]
CMD ["serve", "--http=0.0.0.0:3000", "--dir=/pb_data", "--encryptionEnv=PB_ENCRYPTION_KEY"]
