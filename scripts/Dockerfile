# If you are using windows, run the below command to make it compatible
# dos2unix /usr/local/memos/entrypoint.sh

# Below is Updated Dockerfile

# Step 1: Build frontend
FROM node:20-alpine AS frontend
WORKDIR /app/web

# Copy the necessary files for the frontend build
COPY ./web/ /app/web/
COPY ./proto/ /app/proto/

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
RUN pnpm run release

# Step 2: Build Go backend
FROM golang:1.24-alpine AS backend
WORKDIR /backend-build

# Copy the necessary files for the Go backend build
COPY . .

# Copy built frontend into the backend location
COPY --from=frontend /app/server/router/frontend/dist /backend-build/server/router/frontend/dist

# Build the Go binary
RUN go build -o memos ./bin/memos/main.go

# Step 3: Final image
FROM alpine:latest AS monolithic
WORKDIR /usr/local/memos

# Install dependencies (including bash if needed)
RUN apk add --no-cache tzdata bash

# Set timezone environment variable
ENV TZ="UTC"

# Copy the built Go binary and entrypoint script
COPY --from=backend /backend-build/memos /usr/local/memos/
COPY scripts/entrypoint.sh /usr/local/memos/

# Ensure entrypoint and binary are executable
RUN chmod +x /usr/local/memos/memos /usr/local/memos/entrypoint.sh

# Expose the port for the application
EXPOSE 5230

# Set the volume for data persistence
RUN mkdir -p /var/opt/memos
VOLUME /var/opt/memos

# Set environment variables for the application
ENV MEMOS_MODE="prod"
ENV MEMOS_PORT="5230"

# NOTE: if you want to Connect to External Database
# E.g. GCP Cloud SQL , then uncomment below code and
# Replace Password -> with Database Password
# Replace IP -> with your DB Server IP
# ENV MEMOS_DRIVER=mysql
# ENV MEMOS_DSN=root:password@tcp(34.58.50.141:3306)/memos_prod

# Define the entrypoint command
ENTRYPOINT ["./entrypoint.sh", "./memos"]
