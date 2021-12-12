# Build frontend dist.
FROM node:14.18.2-alpine3.14 AS frontend
WORKDIR /frontend-build

COPY ./web/ .

RUN yarn
RUN yarn build

# Build backend exec file.
FROM golang:1.16.12-alpine3.15 AS backend
WORKDIR /backend-build

RUN apk --no-cache add gcc musl-dev

COPY . .

RUN go build \
    -o memos \
    ./server/main.go

# Make workspace with above generated files.
FROM alpine:3.14.3 AS monolithic
WORKDIR /usr/local/memos

COPY --from=backend /backend-build/memos /usr/local/memos/
# Copy default resources, like db file.
COPY --from=backend /backend-build/resources /usr/local/memos/resources
COPY --from=frontend /frontend-build/dist /usr/local/memos/web/dist

# Directory to store the data, which can be referenced as the mounting point.
RUN mkdir -p /var/opt/memos/data

CMD ["./memos"]

EXPOSE 8080
