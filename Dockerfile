# Build frontend dist.
FROM node:16.15.1-bullseye AS frontend
WORKDIR /frontend-build

COPY ./web/ .

RUN yarn
RUN yarn build

# Build backend exec file.
FROM golang:1.18.3-bullseye AS backend
WORKDIR /backend-build

COPY . .

RUN go build \
    -o memos \
    ./bin/server/main.go

# Make workspace with above generated files.
FROM alpine:3.16.0 AS monolithic
WORKDIR /usr/local/memos

COPY --from=backend /backend-build/memos /usr/local/memos/
COPY --from=frontend /frontend-build/dist /usr/local/memos/web/dist

# Directory to store the data, which can be referenced as the mounting point.
RUN mkdir -p /var/opt/memos

ENTRYPOINT ["./memos"]
