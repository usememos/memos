# Build frontend dist.
FROM node:20-alpine AS frontend
WORKDIR /frontend-build

COPY . .

WORKDIR /frontend-build/web

RUN corepack enable && pnpm i --frozen-lockfile

RUN pnpm build

# Build backend exec file.
FROM golang:1.22-alpine AS backend
WORKDIR /backend-build

COPY . .
COPY --from=frontend /frontend-build/web/dist /backend-build/server/router/frontend/dist

RUN CGO_ENABLED=0 go build -ldflags='-s -w' -trimpath -o memos ./bin/memos/main.go

# Make workspace with above generated files.
FROM gcr.io/distroless/static-debian12:latest AS monolithic
WORKDIR /usr/local/memos

ENV TZ="UTC"

COPY --from=backend /backend-build/memos /usr/local/memos/

EXPOSE 5230

# Directory to store the data, which can be referenced as the mounting point.
VOLUME /var/opt/memos

ENV MEMOS_MODE="prod"
ENV MEMOS_PORT="5230"

ENTRYPOINT ["./memos"]
