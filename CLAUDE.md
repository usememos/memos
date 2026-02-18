# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **See `AGENTS.md`** for full architecture details, key workflows, and file references.

## Project Summary

Memos is a self-hosted knowledge management platform. Go backend (Echo + Connect RPC + gRPC-Gateway), React/TypeScript frontend (Vite + React Query), Protocol Buffers for API definitions. Supports SQLite (default), MySQL, PostgreSQL.

## Common Commands

### Backend

```bash
go run ./cmd/memos --port 8081          # Start dev server
go test ./...                            # All tests
go test ./store/...                      # Store tests only
go test ./server/router/api/v1/test/... # API tests only
golangci-lint run                        # Lint
goimports -w .                           # Format imports
```

### Frontend

```bash
cd web
pnpm install                # Install deps
pnpm dev                    # Dev server (port 3001, proxies to :8081)
pnpm lint                   # TypeScript check + Biome lint
pnpm lint:fix               # Auto-fix
pnpm format                 # Format with Biome
pnpm build                  # Production build
pnpm release                # Build + copy to server/router/frontend/dist/
```

### Protocol Buffers

```bash
cd proto
buf generate                # Regenerate Go + TypeScript from .proto files
buf lint                    # Lint proto definitions
```

## Architecture Overview

```
cmd/memos/          → Entry point (Cobra CLI)
server/             → HTTP server (Echo v5), auth, API services
  router/api/v1/    → gRPC service implementations + Connect RPC handlers
  auth/             → JWT, PAT, session authentication
store/              → Data layer: Driver interface → sqlite/mysql/postgres impls + cache
  migration/        → Versioned SQL migrations per driver
proto/api/v1/       → .proto definitions → generates to proto/gen/ and web/src/types/proto/
web/src/            → React 18.3 + TypeScript frontend
  contexts/         → Client state (AuthContext, ViewContext, MemoFilterContext)
  hooks/            → React Query v5 hooks for server state (use*Queries.ts)
  components/       → UI components
  pages/            → Page-level components
plugin/             → Backend plugins (scheduler, email, filter, webhook, markdown, s3)
```

**Dual API protocol**: Connect RPC at `/memos.api.v1.*` (browser clients) + gRPC-Gateway at `/api/v1/*` (REST). Both use the same service implementations.

**State management**: React Query v5 for server state (hooks/), React Context for client state (contexts/).

## Key Conventions

- **Go errors**: Use `status.Errorf(codes.X, ...)` for gRPC errors. `fmt.Errorf` is forbidden (use `errors.Wrap`).
- **Go imports**: stdlib → third-party → local (`github.com/usememos/memos`). Use `goimports`.
- **Go comments**: Exported functions require doc comments (godot linter enforces period at end).
- **Frontend imports**: Use `@/` alias for absolute imports. Auto-organized by Biome.
- **Frontend styling**: Tailwind CSS v4. Use `clsx` + `tailwind-merge` for conditional classes.
- **Biome config**: 140 char line width, double quotes, semicolons always, 2-space indent.
- **DB changes**: Must add migration SQL for all three drivers + update LATEST.sql.
- **New API endpoints**: Define in .proto → `buf generate` → implement in `*_service.go` → add to `acl_config.go` if public → add React Query hook.
