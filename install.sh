#!/bin/bash

set -e

REPO="usememos/memos"
BINARY_NAME="memos"
INSTALL_DIR="$HOME/.local/bin"

if [[ "$(uname -s)" == *"MINGW"* || "$(uname -s)" == *"MSYS"* || "$(uname -s)" == "Windows_NT" ]]; then
    INSTALL_DIR="$HOME/bin"
    BINARY_NAME="memos.exe"
fi

cleanup() {
    rm -f "$TMPFILE" "$TMPDIR"/*
}
trap cleanup EXIT

echo "Checking for latest version..."

RESPONSE=$(curl -sL "https://api.github.com/repos/$REPO/releases/latest")
LATEST_TAG=$(echo "$RESPONSE" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p')

if [ -z "$LATEST_TAG" ]; then
    echo "Error: Could not fetch latest version. API rate limit may be exceeded."
    exit 1
fi

VERSION="${LATEST_TAG#v}"
echo "Latest version: $LATEST_TAG"

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$OS" in
    linux*)
        case "$ARCH" in
            x86_64) ASSET_NAME="memos_${VERSION}_linux_amd64.tar.gz" ;;
            aarch64) ASSET_NAME="memos_${VERSION}_linux_arm64.tar.gz" ;;
            armv7) ASSET_NAME="memos_${VERSION}_linux_armv7.tar.gz" ;;
            *)
                echo "Unsupported architecture: $ARCH"
                exit 1
                ;;
        esac
        ;;
    darwin*)
        case "$ARCH" in
            x86_64) ASSET_NAME="memos_${VERSION}_darwin_amd64.tar.gz" ;;
            arm64) ASSET_NAME="memos_${VERSION}_darwin_arm64.tar.gz" ;;
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

TMPDIR=$(mktemp -d)
if [[ "$ASSET_NAME" == *.zip ]]; then
    echo "Downloading..."
    curl -fL "$DOWNLOAD_URL" -o "$TMPDIR/memos_install.zip"
    echo "Extracting..."
    unzip -q -o "$TMPDIR/memos_install.zip" -d "$TMPDIR"
    EXTRACTED=$(find "$TMPDIR" -name "memos.exe" -type f)
    if [ -z "$EXTRACTED" ]; then
        echo "Error: Could not find memos.exe in archive"
        exit 1
    fi
    cp "$EXTRACTED" "$INSTALL_DIR/$BINARY_NAME"
    chmod +x "$INSTALL_DIR/$BINARY_NAME"
else
    echo "Downloading..."
    curl -fL "$DOWNLOAD_URL" -o "$TMPDIR/memos_install.tar.gz"
    echo "Extracting..."
    tar -xzf "$TMPDIR/memos_install.tar.gz" -C "$TMPDIR"
    EXTRACTED=$(find "$TMPDIR" -name "memos" -type f)
    if [ -z "$EXTRACTED" ]; then
        echo "Error: Could not find memos binary in archive"
        exit 1
    fi
    cp "$EXTRACTED" "$INSTALL_DIR/$BINARY_NAME"
    chmod +x "$INSTALL_DIR/$BINARY_NAME"
fi

echo "Installed to $INSTALL_DIR/$BINARY_NAME"
echo ""
echo "Run: $BINARY_NAME"
