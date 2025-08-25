# Memos Build Instructions

This document outlines the steps to build Memos from source, including both the backend (Go) and frontend (React/TypeScript).

## Prerequisites

- Go 1.24 or later
- Node.js and npm (for frontend)
- Git

## Build Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/usememos/memos.git
   cd memos
   ```

2. **Install Go 1.24:**
   First, try installing through your package manager:
   ```bash
   sudo apt-get update
   sudo apt-get install golang-1.24
   ```
   
   If Go 1.24 is not available in your package manager, you can install it manually:
   ```bash
   wget https://go.dev/dl/go1.24.0.linux-arm64.tar.gz
   sudo tar -C /usr/local -xzf go1.24.0.linux-arm64.tar.gz
   ```
   
   Add Go to your PATH by adding these lines to your `~/.bashrc`:
   ```bash
   export GOROOT=/usr/local/go
   export PATH=$GOROOT/bin:$PATH
   ```
   
   Reload your shell configuration:
   ```bash
   source ~/.bashrc
   ```
   
   Verify the installation:
   ```bash
   go version
   ```
   You should see `go version go1.24.0` in the output.

3. **Build the frontend:**
   Navigate to the web directory and install dependencies:
   ```bash
   cd web
   npm install
   ```
   
   Build the frontend for release (this places the files in the correct location for embedding):
   ```bash
   npm run release
   ```
   
   This will output the built files to `../server/router/frontend/dist`.

4. **Build the backend:**
   Run the build script:
   ```bash
   cd ..
   bash scripts/build.sh
   ```
   
   This will create the `memos` executable in the `./build` directory.

5. **Run the application:**
   ```bash
   ./build/memos --mode dev
   ```

The application should now be accessible at `http://localhost:5230` with the embedded frontend.