FROM golang:1.25-alpine AS backend
WORKDIR /backend-build

# Install build dependencies
RUN apk add --no-cache git ca-certificates

# Copy go mod files and download dependencies (cached layer)
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

# Copy source code
COPY . .

# Please build frontend first, so that the static files are available.
# Refer to `pnpm release` in package.json for the build command.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -extldflags '-static'" -o memos ./cmd/memos

FROM alpine:latest AS monolithic
WORKDIR /usr/local/memos

# Install runtime dependencies in single layer
RUN apk add --no-cache tzdata ca-certificates && \
    mkdir -p /var/opt/memos

ENV TZ="UTC" \
    MEMOS_MODE="prod" \
    MEMOS_PORT="5230"

COPY --from=backend /backend-build/memos /usr/local/memos/
COPY ./scripts/entrypoint.sh /usr/local/memos/

EXPOSE 5230

# Directory to store the data, which can be referenced as the mounting point.
VOLUME /var/opt/memos

ENTRYPOINT ["./entrypoint.sh", "./memos"]
