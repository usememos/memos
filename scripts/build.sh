#!/bin/bash

# Usage: ./scripts/build.sh

set -e

cd "$(dirname "$0")/../"

echo "Start building..."

go build -o ./memos-build/memos ./bin/server/main.go

echo "Build finished"
