# Build frontend dist.
FROM node:18.12.1-alpine3.16 AS frontend
WORKDIR /frontend-build

COPY ./web/package.json ./web/pnpm-lock.yaml ./

RUN npm install -g pnpm && pnpm i --frozen-lockfile

COPY ./web/ .

RUN pnpm build

# Build backend exec file.
FROM golang:1.19.3-alpine3.16 AS backend
WORKDIR /backend-build

RUN apk update && apk add --no-cache gcc musl-dev

COPY . .
COPY --from=frontend /frontend-build/dist ./server/dist

RUN go build -o memos ./main.go

# Make workspace with above generated files.
FROM alpine:3.16 AS monolithic
WORKDIR /usr/local/memos

# Install litestream
ADD https://github.com/benbjohnson/litestream/releases/download/v0.3.9/litestream-v0.3.9-linux-amd64-static.tar.gz /tmp/litestream.tar.gz
RUN tar -C /usr/local/bin -xzf /tmp/litestream.tar.gz

# Add litestream config
COPY etc/litestream.yml /etc/litestream.yml

RUN apk add --no-cache tzdata
ENV TZ="UTC"

COPY --from=backend /backend-build/memos /usr/local/memos/

EXPOSE 5230

# Directory to store the data, which can be referenced as the mounting point.
RUN mkdir -p /var/opt/memos

# Copy startup script and make it executable.
COPY scripts/run.sh ./run.sh
RUN chmod +x ./run.sh

# Litestream spawns memos as subprocess.
CMD ["./run.sh"]