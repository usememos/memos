# Multi-stage build for Memos: backend (Go) + frontend (Node.js)

# Stage 1: Build frontend (Node.js)
FROM node:24-alpine AS frontend-builder
WORKDIR /app

COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./web/
RUN npm install -g pnpm@11.0.1 && cd web && pnpm install --frozen-lockfile

COPY web ./web
RUN cd web && pnpm run release

# Stage 2: Build backend (Go)
FROM golang:1.26.2-alpine AS backend-builder
WORKDIR /app

RUN apk add --no-cache git make gcc musl-dev
COPY go.mod go.sum ./
RUN go mod download

COPY . .
COPY --from=frontend-builder /app/server/router/frontend/dist ./server/router/frontend/dist

RUN CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -o memos ./cmd/memos

# Stage 3: Runtime image
FROM alpine:latest
WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=backend-builder /app/memos /usr/local/bin/memos

EXPOSE 8081
VOLUME ["/var/opt/memos"]

CMD ["memos", "--port", "8081", "--data", "/var/opt/memos"]
