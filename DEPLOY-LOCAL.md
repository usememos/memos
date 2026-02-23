# Local Docker Deployment

Steps to build and run Memos locally using Docker (no registry required).

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| [Go](https://go.dev/dl/) | 1.23+ | Required to run/test the backend locally |
| [Node.js](https://nodejs.org/) | 20+ | Required to build the frontend |
| [pnpm](https://pnpm.io/installation) | 9+ (`npm i -g pnpm`) | Frontend package manager |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | latest | Includes Docker Compose v2; enable WSL 2 backend on Windows |
| [Git](https://git-scm.com/) | any | To clone the repo |

Verify installs:

```bash
go version
node --version
pnpm --version
docker --version
docker compose version
```

## 1. Build the Frontend

```bash
cd web
pnpm install
pnpm release
```

This compiles the React app and copies the output to `server/router/frontend/dist/`.

## 2. Build the Docker Image

From the repo root:

```bash
docker build -f scripts/Dockerfile -t memos:local .
```

- Dockerfile is at `scripts/Dockerfile`
- Tag `memos:local` keeps it distinct from any pulled images

## 3. Run with Docker Compose

Create a `docker-compose.yml` (or add to an existing one):

```yaml
services:
  memos:
    image: memos:local
    ports:
      - "5230:5230"
    volumes:
      - ./data:/var/opt/memos
    restart: unless-stopped
```

Then start it:

```bash
docker compose up
```

Access the app at http://localhost:5230.

## Notes

- **Dockerfile location**: `scripts/Dockerfile` (not the repo root).
- **No registry needed**: the `memos:local` tag is local-only; nothing is pushed.
- **Data persistence**: the `./data` volume mount keeps the SQLite DB between restarts.
- **Docker Desktop on Windows 11**: ensure the WSL 2 backend is enabled and the repo is cloned inside WSL or a path Docker Desktop can access.
- **Rebuilding**: re-run steps 1–2 after any code changes, then `docker compose up --build` (or re-tag and restart).
