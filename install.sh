#!/bin/bash

set -e

REPO="usememos/memos"
BINARY_NAME="memos"
INSTALL_DIR="$HOME/.local/bin"

echo "Checking for latest version..."

LATEST_TAG=$(curl -sL "https://api.github.com/repos/$REPO/releases/latest" | grep -oP '"tag_name":\s*"\K[^"]+')

echo "Latest version: $LATEST_TAG"

if [ -f "$INSTALL_DIR/$BINARY_NAME" ]; then
    CURRENT_VERSION=$("$INSTALL_DIR/$BINARY_NAME" --version 2>/dev/null | awk '{print $2}')
    if [ "$CURRENT_VERSION" = "$LATEST_TAG" ]; then
        echo "Already at the latest version ($LATEST_TAG)"
        exit 0
    fi
fi

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$OS" in
    linux*)
        case "$ARCH" in
            x86_64) ASSET_NAME="memos_${LATEST_TAG}_linux_amd64.tar.gz" ;;
            aarch64) ASSET_NAME="memos_${LATEST_TAG}_linux_arm64.tar.gz" ;;
            armv7) ASSET_NAME="memos_${LATEST_TAG}_linux_armv7.tar.gz" ;;
            *)
                echo "Unsupported architecture: $ARCH"
                exit 1
                ;;
        esac
        ;;
    darwin*)
        case "$ARCH" in
            x86_64) ASSET_NAME="memos_${LATEST_TAG}_darwin_amd64.tar.gz" ;;
            arm64) ASSET_NAME="memos_${LATEST_TAG}_darwin_arm64.tar.gz" ;;
            *)
                echo "Unsupported architecture: $ARCH"
                exit 1
                ;;
        esac
        ;;
    *)
        echo "Unsupported OS: $OS"
        exit 1
        ;;
esac

DOWNLOAD_URL="https://github.com/$REPO/releases/download/$LATEST_TAG/$ASSET_NAME"

echo "Downloading from: $DOWNLOAD_URL"

mkdir -p "$INSTALL_DIR"

echo "Downloading..."
curl -fL "$DOWNLOAD_URL" -o "/tmp/memos_install.tar.gz"

echo "Extracting..."
tar -xzf "/tmp/memos_install.tar.gz" -C "$INSTALL_DIR" memos
chmod +x "$INSTALL_DIR/$BINARY_NAME"
rm -f "/tmp/memos_install.tar.gz"

echo "Installed to $INSTALL_DIR/$BINARY_NAME"
echo ""
echo "Run: $BINARY_NAME --version"
