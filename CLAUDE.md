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

**Why React Query + Context for frontend state?**
- **Server state** (memos, users, attachments) managed by React Query (TanStack Query v5)
  - Automatic caching, deduplication, and background refetching
  - Hooks in `web/src/hooks/useMemoQueries.ts`, `useUserQueries.ts`, `useAttachmentQueries.ts`
- **Client state** (UI preferences, filters) managed by React Context
  - ViewContext (`web/src/contexts/ViewContext.tsx`) - layout, sort order
  - MemoFilterContext (`web/src/contexts/MemoFilterContext.tsx`) - filter state
- **Legacy MobX** still present in some components (gradual migration in progress)
  - Stores in `web/src/store/` used by unmigrated components
  - Both systems coexist during transition period

## Critical Development Commands

**Backend:**
```bash
go run ./cmd/memos --mode dev --port 8081    # Start dev server
go test ./...                                 # Run tests
golangci-lint run                            # Lint
```

**Frontend:**
```bash
cd web && pnpm dev                           # Start dev server (React Query devtools at bottom-left)
cd web && pnpm lint:fix                      # Lint and fix
cd web && pnpm release                       # Build and copy to backend
```

**Protocol Buffers:**
```bash
cd proto && buf generate                     # Regenerate Go + TypeScript from .proto
```

## Frontend State Management

**Using React Query (Server State):**
```typescript
// Fetch memos
import { useMemos, useMemo } from "@/hooks/useMemoQueries";
const { data: memos, isLoading } = useMemos({ filter });
const { data: memo } = useMemo(memoName);

// Mutations
import { useCreateMemo, useUpdateMemo } from "@/hooks/useMemoQueries";
const { mutate: createMemo } = useCreateMemo();
const { mutate: updateMemo } = useUpdateMemo();
```

**Using Context (Client State):**
```typescript
// View preferences
import { useView } from "@/contexts/ViewContext";
const { layout, setLayout, orderByTimeAsc, toggleSortOrder } = useView();

// Filters
import { useMemoFilter } from "@/contexts/MemoFilterContext";
const { filter, updateFilter } = useMemoFilter();
```

**React Query DevTools:**
- Available in dev mode at bottom-left corner
- Inspect query cache, mutations, and refetch behavior
- Query keys organized by resource: `memoKeys`, `userKeys`, `attachmentKeys`

**Migration Status:**
- ✅ Migrated: Home, MemoDetail, UserProfile, Inboxes pages
- 🔄 In Progress: Remaining pages and components (gradual migration)
- See `web/scripts/migration-guide.md` for migration patterns

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
**Frontend:** `web/src/` React app with React Query + Context (migrating from MobX)

## Testing Expectations

Go tests are required for store and API changes. Frontend relies on TypeScript checking and manual validation.

Run `go test ./store/...` and `go test ./server/router/api/v1/test/...` before committing backend changes.

## Configuration

Backend accepts flags or `MEMOS_*` environment variables:
- `--mode` / `MEMOS_MODE`: `dev`, `prod`, `demo`
- `--port` / `MEMOS_PORT`: HTTP/gRPC port (default: 5230)
- `--data` / `MEMOS_DATA`: Data directory (default: ~/.memos)
- `--driver` / `MEMOS_DRIVER`: `sqlite`, `mysql`, `postgres`
