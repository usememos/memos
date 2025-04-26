# Base image with Go pre-installed
FROM golang:1.24-bullseye

# Arguments for user configuration
ARG USERNAME=dev
ARG UID=1000
ARG GID=1000

# Install necessary packages and create a non-root user
RUN apt-get update && apt-get install -y \
    sudo \
    curl \
    git \
    make \
    gcc \
    && groupadd --gid $GID $USERNAME \
    && useradd --uid $UID --gid $GID -m $USERNAME \
    && echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Node.js and pnpm
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pnpm

# Switch to non-root user
USER $USERNAME

# Configure pnpm to avoid long path issues
RUN pnpm config set store-dir /home/dev/.pnpm-store && \
    pnpm config set virtual-store-dir .pnpm


# Set environment variables
ENV PATH="/usr/local/go/bin:${PATH}"


# Set working directory
WORKDIR /workspaces/memos
