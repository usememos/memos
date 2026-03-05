# Memos Codebase Guide for AI Agents

Self-hosted knowledge management platform. Go 1.25 backend (Echo v5, Connect RPC + gRPC-Gateway), React 18 + TypeScript 5.9 + Vite 7 frontend, Protocol Buffers API, SQLite/MySQL/PostgreSQL.

## Commands

```bash
# Backend
go run ./cmd/memos --port 8081    # Start dev server
go test ./...                      # Run all tests
golangci-lint run                  # Lint (v2)
goimports -w .                     # Format imports

# Frontend (cd web)
pnpm install                       # Install deps
pnpm dev                           # Dev server (:3001, proxies API to :8081)
pnpm lint                          # Type check + Biome lint
pnpm lint:fix                      # Auto-fix lint issues
pnpm format                        # Format code
pnpm build                         # Production build
pnpm release                       # Build to server/router/frontend/dist

# Protocol Buffers (cd proto)
buf generate                       # Regenerate Go + TypeScript + OpenAPI
buf lint                           # Lint proto files
```

## Architecture

```
cmd/memos/main.go           # Cobra CLI + Viper config, server init

server/
├── server.go               # Echo v5 HTTP server, background runners
├── auth/                   # JWT access (15min) + refresh (30d) tokens, PAT
├── router/
│   ├── api/v1/             # 9 gRPC services (Connect + Gateway)
│   │   ├── acl_config.go   # Public endpoints whitelist
│   │   ├── sse_hub.go      # Server-Sent Events (live updates)
│   │   └── mcp/            # MCP server for AI assistants
│   ├── frontend/           # SPA static file serving
│   ├── fileserver/         # Native HTTP file server (thumbnails, range requests)
│   └── rss/                # RSS feeds
└── runner/                 # Background: memo payload processing, S3 presign refresh

store/
├── driver.go               # Database driver interface
├── store.go                # Store wrapper + in-memory cache (TTL 10min, max 1000)
├── migrator.go             # Migration logic (LATEST.sql for fresh, incremental for upgrades)
└── db/{sqlite,mysql,postgres}/  # Driver implementations

proto/
├── api/v1/                 # Service definitions
├── store/                  # Internal storage messages
└── gen/                    # Generated Go, TypeScript, OpenAPI

plugin/                     # scheduler, cron, email, filter (CEL), webhook,
                            # markdown (Goldmark), httpgetter, idp (OAuth2), storage/s3

web/src/
├── connect.ts              # Connect RPC client + auth interceptor + token refresh
├── auth-state.ts           # Token storage (localStorage + BroadcastChannel cross-tab)
├── contexts/               # AuthContext, InstanceContext, ViewContext, MemoFilterContext
├── hooks/                  # React Query hooks (useMemoQueries, useUserQueries, etc.)
├── lib/query-client.ts     # React Query v5 (staleTime: 30s, gcTime: 5min)
├── router/index.tsx        # Route definitions
├── components/             # UI components (Radix UI primitives, MemoEditor, Settings, etc.)
├── themes/                 # CSS themes (default, dark, paper) — OKLch color tokens
└── pages/                  # 14 page components
```

## Conventions

### Go
- **Errors:** `errors.Wrap(err, "context")` from `github.com/pkg/errors`. Never `fmt.Errorf` (lint-enforced).
- **gRPC errors:** `status.Errorf(codes.X, "message")` from service methods.
- **Imports:** stdlib → third-party → local (`github.com/usememos/memos`). Run `goimports -w .`.
- **Comments:** All exported functions must have doc comments (godot enforced).

### Frontend
- **Imports:** Use `@/` alias for absolute imports.
- **Formatting:** Biome — 140 char lines, double quotes, always semicolons, 2-space indent.
- **State:** Server data via React Query hooks (`hooks/`). Client state via React Context (`contexts/`).
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite`), `cn()` utility (clsx + tailwind-merge), CVA for variants.

### Database & Proto
- **DB changes:** Migration files for all 3 drivers + update `LATEST.sql`.
- **Proto changes:** Run `buf generate`. Generated code: `proto/gen/` and `web/src/types/proto/`.
- **Public endpoints:** Add to `server/router/api/v1/acl_config.go`.

## CI/CD

- **backend-tests.yml:** Go 1.25.7, golangci-lint v2.4.0, tests parallelized by group (store tests all 3 DBs via TestContainers)
- **frontend-tests.yml:** Node 22, pnpm 10, lint + build
- **proto-linter.yml:** buf lint + format check
- **Docker:** Multi-stage (`scripts/Dockerfile`), Alpine 3.21, non-root user, port 5230, multi-arch (amd64/arm64/arm/v7)
