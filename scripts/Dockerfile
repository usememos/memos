FROM golang:1.25-alpine AS backend
ARG MEMOS_BUILD_TAGS=""
ARG CGO_ENABLED=0
ARG CGO_CFLAGS=""
ARG CGO_LDFLAGS=""
ENV CGO_ENABLED=${CGO_ENABLED}
ENV MEMOS_BUILD_TAGS=${MEMOS_BUILD_TAGS}
ENV CGO_CFLAGS=${CGO_CFLAGS}
ENV CGO_LDFLAGS=${CGO_LDFLAGS}
WORKDIR /backend-build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Please build frontend first, so that the static files are available.
# Refer to `pnpm release` in package.json for the build command.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    /bin/sh -eux <<'EOF'
if [ "${CGO_ENABLED}" = "1" ]; then
    apk add --no-cache --virtual .build-deps build-base pkgconf
    if printf "%s" "${MEMOS_BUILD_TAGS}" | grep -q "memos_sqlcipher"; then
        apk add --no-cache --virtual .sqlcipher-build sqlcipher-dev
        SQLCIPHER_CFLAGS="$(pkg-config --cflags sqlcipher)"
        SQLCIPHER_LDFLAGS="$(pkg-config --libs sqlcipher)"
        if [ ! -e /usr/lib/libsqlite3.so ]; then
            ln -s /usr/lib/libsqlcipher.so /usr/lib/libsqlite3.so
        fi
        if [ -z "${CGO_CFLAGS}" ]; then
            export CGO_CFLAGS="${SQLCIPHER_CFLAGS} -DSQLITE_HAS_CODEC"
        else
            export CGO_CFLAGS="${CGO_CFLAGS} ${SQLCIPHER_CFLAGS} -DSQLITE_HAS_CODEC"
        fi
        if [ -z "${CGO_LDFLAGS}" ]; then
            export CGO_LDFLAGS="${SQLCIPHER_LDFLAGS}"
        else
            export CGO_LDFLAGS="${CGO_LDFLAGS} ${SQLCIPHER_LDFLAGS}"
        fi
    fi
fi

go build -ldflags="-s -w" -tags="${MEMOS_BUILD_TAGS}" -o memos ./bin/memos/main.go

if [ "${CGO_ENABLED}" = "1" ]; then
    if apk info -e .sqlcipher-build >/dev/null 2>&1; then
        apk del .sqlcipher-build
    fi
    apk del .build-deps
fi
EOF

# Make workspace with above generated files.
FROM alpine:latest AS monolithic
ARG MEMOS_BUILD_TAGS=""
WORKDIR /usr/local/memos

RUN apk add --no-cache tzdata
RUN if printf "%s" "$MEMOS_BUILD_TAGS" | grep -q "memos_sqlcipher"; then \
    apk add --no-cache sqlcipher sqlcipher-libs && \
    if [ -e /usr/lib/libsqlcipher.so ]; then ln -sf /usr/lib/libsqlcipher.so /usr/lib/libsqlite3.so; fi && \
    if [ -e /usr/lib/libsqlcipher.so.0 ]; then ln -sf /usr/lib/libsqlcipher.so.0 /usr/lib/libsqlcipher.so; fi; \
  fi
ENV TZ="UTC"

COPY --from=backend /backend-build/memos /usr/local/memos/
COPY ./scripts/entrypoint.sh /usr/local/memos/

EXPOSE 5230

# Directory to store the data, which can be referenced as the mounting point.
RUN mkdir -p /var/opt/memos
VOLUME /var/opt/memos

ENV MEMOS_MODE="prod"
ENV MEMOS_PORT="5230"

ENTRYPOINT ["./entrypoint.sh", "./memos"]
