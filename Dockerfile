# Build protobuf.
FROM golang:1.21-alpine AS protobuf
WORKDIR /protobuf-generate

COPY . .

RUN GO111MODULE=on GOBIN=/usr/local/bin go install github.com/bufbuild/buf/cmd/buf@v1.26.1

WORKDIR /protobuf-generate/proto

RUN buf generate

# Build frontend dist.
FROM node:18-alpine AS frontend
WORKDIR /frontend-build

COPY ./web .

COPY --from=protobuf /protobuf-generate/web/src/types/proto ./src/types/proto

RUN corepack enable && pnpm i --frozen-lockfile

RUN pnpm build

# Build backend exec file.
FROM golang:1.21-alpine AS backend
WORKDIR /backend-build

COPY . .
COPY --from=frontend /frontend-build/dist ./server/dist

RUN CGO_ENABLED=0 go build -o memos ./main.go

# Make workspace with above generated files.
FROM alpine:latest AS monolithic
WORKDIR /usr/local/memos

RUN apk add --no-cache tzdata
ENV TZ="UTC"

COPY --from=backend /backend-build/memos /usr/local/memos/

EXPOSE 5230

# Directory to store the data, which can be referenced as the mounting point.
RUN mkdir -p /var/opt/memos
VOLUME /var/opt/memos

ENV MEMOS_MODE="prod"
ENV MEMOS_PORT="5230"

ENTRYPOINT ["./memos"]
