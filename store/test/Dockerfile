FROM golang:1.25-alpine AS backend
WORKDIR /backend-build
COPY . .
RUN go build -o memos ./cmd/memos

FROM alpine:latest
WORKDIR /usr/local/memos
COPY --from=backend /backend-build/memos /usr/local/memos/
EXPOSE 5230
RUN mkdir -p /var/opt/memos
ENV MEMOS_MODE="prod"
ENV MEMOS_PORT="5230"
ENTRYPOINT ["./memos"]
