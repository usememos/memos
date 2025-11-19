#!/bin/bash

set -e

echo "Building Memos iOS Framework..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if gomobile is installed
if ! command -v gomobile &> /dev/null; then
    echo -e "${YELLOW}gomobile not found. Installing...${NC}"
    go install golang.org/x/mobile/cmd/gomobile@latest
    gomobile init
fi

# Navigate to project root
cd "$(dirname "$0")/.."

# Clean previous builds
echo -e "${YELLOW}Cleaning previous builds...${NC}"
rm -rf ios/Frameworks/Mobile.xcframework

# Build the mobile framework
echo -e "${YELLOW}Building Go mobile framework...${NC}"
gomobile bind -target=ios -o ios/Frameworks/Mobile.xcframework ./mobile

echo -e "${GREEN}✓ iOS Framework built successfully!${NC}"
echo ""
echo "Framework location: ios/Frameworks/Mobile.xcframework"
echo ""
echo "Next steps:"
echo "1. Open ios/Memos.xcodeproj in Xcode"
echo "2. Connect your iOS device or select a simulator"
echo "3. Build and run the project (Cmd+R)"
echo ""
echo "Note: The first build may take several minutes as it compiles the Go backend."
