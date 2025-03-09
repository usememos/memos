#!/bin/sh

# Exit when any command fails
set -e

# Get the script directory and change to the project root
cd "$(dirname "$0")/../"

# Detect the operating system
OS=$(uname -s)

# Set output file name based on the OS
if [[ "$OS" == *"CYGWIN"* || "$OS" == *"MINGW"* || "$OS" == *"MSYS"* ]]; then
  OUTPUT="./build/memos.exe"
else
  OUTPUT="./build/memos"
fi

echo "Building for $OS..."

# Build the executable
go build -o "$OUTPUT" ./bin/memos/main.go

# Output the success message
echo "Build successful!"

# Output the command to run
echo "To run the application, execute the following command:"
echo "$OUTPUT --mode dev"
