# Memos Codebase Guide

## Project Overview

Memos is a self-hosted knowledge management platform with a Go backend and React frontend. The architecture uses gRPC for internal communication with REST access via gRPC-Gateway.

## Architecture Decision Context

**Why gRPC + gRPC-Gateway?**
- Native gRPC for performance, REST API for compatibility
- Both protocols served on same port via `cmux` connection multiplexer
- Frontend uses gRPC-Web (`nice-grpc-web`) for type-safe API calls

**Why multi-database support?**
- Store interface (`store/driver.go`) abstracts persistence
- Three implementations: SQLite (default), MySQL, PostgreSQL
- Each driver has its own migration files in `store/db/{driver}/migration/`
- Schema version tracked in `instance_setting` table (key: `bb.general.version`)

**Why MobX for frontend state?**
- Simpler than Redux for this application's needs
- Stores in `web/src/store/` handle global state (user, memos, editor, dialogs)

## Critical Development Commands

**Backend:**
```bash
go run ./cmd/memos --mode dev --port 8081    # Start dev server
go test ./...                                 # Run tests
golangci-lint run                            # Lint
```

**Frontend:**
```bash
cd web && pnpm dev                           # Start dev server
cd web && pnpm lint:fix                      # Lint and fix
cd web && pnpm release                       # Build and copy to backend
```

**Protocol Buffers:**
```bash
cd proto && buf generate                     # Regenerate Go + TypeScript from .proto
```

## Key Workflows

**Modifying APIs:**
1. Edit `.proto` files in `proto/api/v1/`
2. Run `buf generate` to regenerate code
3. Implement in `server/router/api/v1/`
4. Frontend types auto-update in `web/src/types/proto/`

**Database Schema Changes:**
1. Create migration files: `store/migration/{sqlite,mysql,postgres}/{version}/NN__description.sql`
2. Update `LATEST.sql` in each driver directory
3. Schema version auto-determined from migration files
4. If adding new tables/models, also update `store/driver.go` interface and implementations

**Authentication Flow:**
- Interceptor runs on all gRPC methods (`server/router/api/v1/acl.go`)
- Public endpoints listed in `acl_config.go`
- Supports both session cookies and JWT bearer tokens

## Critical Path Components

**Entry point:** `cmd/memos/` starts the server
**API layer:** `server/router/api/v1/` implements gRPC services
**Data layer:** `store/` handles all persistence
**Frontend:** `web/src/` React app with MobX state management

## Testing Expectations

Go tests are required for store and API changes. Frontend relies on TypeScript checking and manual validation.

Run `go test ./store/...` and `go test ./server/router/api/v1/test/...` before committing backend changes.

## Configuration

Backend accepts flags or `MEMOS_*` environment variables:
- `--mode` / `MEMOS_MODE`: `dev`, `prod`, `demo`
- `--port` / `MEMOS_PORT`: HTTP/gRPC port (default: 5230)
- `--data` / `MEMOS_DATA`: Data directory (default: ~/.memos)
- `--driver` / `MEMOS_DRIVER`: `sqlite`, `mysql`, `postgres`
