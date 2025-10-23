# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Memos is a lightweight, self-hosted knowledge management and note-taking platform. The architecture pairs a Go backend with a React+Vite frontend, using gRPC for internal communication and providing REST API access via gRPC-Gateway.

## Development Commands

### Backend (Go)

**Start Development Server:**
```bash
go run ./cmd/memos --mode dev --port 8081
```

**Build Binary:**
```bash
go build ./cmd/memos
```

**Run Tests:**
```bash
go test ./...                    # All tests
go test ./store/...              # Store layer tests only
go test ./server/router/api/v1/test/...  # API tests
```

**Lint:**
```bash
golangci-lint run                # Full lint check (uses .golangci.yaml)
```

**Generate Protocol Buffers:**
```bash
cd proto
buf generate                     # Generate Go/TypeScript from .proto files
buf format -w                    # Format proto files
```

### Frontend (React + Vite)

**Install Dependencies:**
```bash
cd web
pnpm install
```

**Development Server:**
```bash
cd web
pnpm dev                         # Hot-reload dev server (typically :5173)
```

**Build:**
```bash
cd web
pnpm build                       # Build to web/dist/
pnpm release                     # Build and copy to server/router/frontend/dist/
```

**Lint:**
```bash
cd web
pnpm lint                        # TypeScript check + ESLint
```

### CLI Flags and Environment Variables

The backend accepts the following configuration via flags or `MEMOS_*` environment variables:

- `--mode` / `MEMOS_MODE` - Runtime mode: `dev`, `prod`, `demo` (default: `prod`)
- `--addr` / `MEMOS_ADDR` - Bind address (default: `0.0.0.0`)
- `--port` / `MEMOS_PORT` - HTTP/gRPC port (default: `5230`)
- `--unix-sock` / `MEMOS_UNIX_SOCK` - Unix socket path (optional)
- `--data` / `MEMOS_DATA` - Data directory for SQLite (default: `~/.memos`)
- `--driver` / `MEMOS_DRIVER` - Database driver: `sqlite`, `mysql`, `postgres` (default: `sqlite`)
- `--dsn` / `MEMOS_DSN` - Database connection string (for MySQL/PostgreSQL)
- `--instance-url` / `MEMOS_INSTANCE_URL` - Public instance URL for webhooks/OAuth

## Architecture

### High-Level Structure

```
cmd/memos/           # CLI entry point, starts HTTP+gRPC server
server/              # HTTP server and routing
  ├── router/api/v1/ # gRPC services + gRPC-Gateway REST handlers
  ├── router/frontend/ # Embedded SPA static file serving
  └── router/rss/    # RSS feed generation
internal/            # Shared domain logic and utilities
  ├── base/          # Base types and constants
  ├── profile/       # Configuration profile handling
  ├── util/          # Utility functions
  └── version/       # Version information
store/               # Data persistence layer (repository pattern)
  ├── db/            # Database driver implementations
  │   ├── sqlite/    # SQLite driver + migrations
  │   ├── mysql/     # MySQL driver + migrations
  │   └── postgres/  # PostgreSQL driver + migrations
  └── cache/         # In-memory caching
proto/               # Protocol Buffer definitions
  └── api/v1/        # API service contracts (.proto files)
web/                 # Frontend React application
  ├── src/
  │   ├── components/ # React components
  │   ├── pages/     # Page-level components
  │   ├── store/     # MobX state management
  │   ├── router/    # React Router configuration
  │   ├── locales/   # i18n translation files
  │   ├── hooks/     # Custom React hooks
  │   └── utils/     # Utility functions
  └── public/        # Static assets
```

### API Architecture

**Dual Protocol Serving:**
The server uses `cmux` (connection multiplexer) to serve both gRPC and HTTP on the same port:
- **HTTP/2 + `application/grpc`** → Native gRPC server
- **HTTP/1.1** → Echo server (REST API via gRPC-Gateway, static files, RSS)

**API Services** (defined in `proto/api/v1/*.proto`):
- `WorkspaceService` - Workspace settings and profiles
- `AuthService` - Authentication and session management
- `UserService` - User management
- `MemoService` - Core memo CRUD operations
- `AttachmentService` - File uploads and storage
- `InboxService` - Inbox items
- `ActivityService` - Activity logging
- `MarkdownService` - Markdown utilities (link metadata, etc.)
- `IdentityProviderService` - OAuth/SSO providers
- `ShortcutService` - User shortcuts

**API Access Methods:**
1. **Native gRPC** - Direct gRPC calls to `memos.api.v1.*` services
2. **REST API** - HTTP REST at `/api/v1/*` (via gRPC-Gateway)
3. **gRPC-Web** - Browser gRPC calls to `/memos.api.v1.*` (via grpc-web proxy)

### Database Layer

**Store Interface:**
The `store.Driver` interface (`store/driver.go`) defines all data access methods. Three implementations exist:
- `store/db/sqlite/` - SQLite driver (default, embedded database)
- `store/db/mysql/` - MySQL driver
- `store/db/postgres/` - PostgreSQL driver

**Migrations:**
Each driver contains its own migration files in subdirectories. Schema version tracking is stored in `workspace_setting` (key: `bb.general.version`). The `store/migrator.go` orchestrates migrations across all drivers.

**Key Models:**
- `Memo` - Core note/memo entity
- `User` - User accounts
- `Attachment` - Uploaded files and images
- `MemoRelation` - Graph relationships between memos
- `Activity` - Activity log entries
- `Inbox` - Inbox items
- `Reaction` - Emoji reactions
- `WorkspaceSetting` - Workspace-level configuration
- `UserSetting` - User preferences
- `IdentityProvider` - OAuth/SSO provider configs

### Frontend Architecture

**Tech Stack:**
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite 7
- **Routing:** React Router 7
- **State Management:** MobX
- **Styling:** Tailwind CSS 4 + Emotion
- **UI Components:** Radix UI primitives
- **i18n:** react-i18next with language files in `web/src/locales/`

**State Management:**
MobX stores in `web/src/store/` handle global state:
- `userStore` - Current user session
- `memoStore` - Memo collection and filters
- `editorStore` - Memo editor state
- `dialogStore` - Modal dialogs
- etc.

**gRPC-Web Client:**
The frontend uses `nice-grpc-web` to call backend services. Client setup is in `web/src/grpcweb.ts`.

### Authentication

**Dual Auth Support:**
1. **Session-based (Cookie):** `user_session` cookie with format `{userID}-{sessionID}`
2. **Token-based (JWT):** `Authorization: Bearer <token>` header

**Flow:**
- Authentication interceptor (`server/router/api/v1/acl.go`) runs on all gRPC methods
- Public endpoints bypass auth (see `acl_config.go` for allowlist)
- Context values set: `userIDContextKey`, `sessionIDContextKey`, `accessTokenContextKey`
- Sessions have sliding expiration (14 days from last access)

## Code Style and Conventions

### Go

- **Formatting:** All code must be `gofmt`-compliant (tabs for indentation)
- **Imports:** Group stdlib, external, and local imports (enforced by `goimports`)
- **Error Handling:** Wrap errors with `%w` when propagating: `errors.Wrap(err, "context")`
- **Naming:** Package names lowercase, no underscores
- **Linting:** Enforced via `.golangci.yaml` (revive, staticcheck, gocritic, etc.)

### TypeScript/React

- **Components:** PascalCase filenames (e.g., `MemoEditor.tsx`)
- **Hooks:** camelCase filenames (e.g., `useMemoList.ts`)
- **Formatting:** Prettier enforced (see `web/.prettierrc.js`)
- **Import Ordering:** Managed by `@trivago/prettier-plugin-sort-imports`
- **Styling:** Tailwind utility classes preferred over custom CSS

### Commit Messages

Follow Conventional Commits format:
- `feat(scope): description` - New features
- `fix(scope): description` - Bug fixes
- `chore(scope): description` - Maintenance tasks
- `refactor(scope): description` - Code restructuring
- `test(scope): description` - Test additions/fixes
- `docs(scope): description` - Documentation updates

Scopes: `server`, `api`, `store`, `web`, `proto`, etc.

## Testing

**Go Tests:**
- Test files: `*_test.go` alongside source files
- Run specific package: `go test ./store/cache/...`
- API integration tests: `server/router/api/v1/test/*_test.go`
- Prefer table-driven tests for multiple test cases

**Frontend:**
Currently relies on linting and manual testing. For UI changes, validate with local dev server.

## Protocol Buffer Workflow

**Prerequisites:** Install [buf](https://docs.buf.build/installation)

**Modifying APIs:**
1. Edit `.proto` files in `proto/api/v1/`
2. Run `cd proto && buf generate` to regenerate Go and TypeScript code
3. Update service implementations in `server/router/api/v1/`
4. Update frontend gRPC-Web clients in `web/src/`

**Generated Code Locations:**
- Go: `proto/gen/api/v1/`
- TypeScript: `web/src/types/proto/api/v1/`

## Database Migrations

When adding database schema changes:

1. Create migration file in driver-specific directory:
   - SQLite: `store/db/sqlite/migration/`
   - MySQL: `store/db/mysql/migration/`
   - PostgreSQL: `store/db/postgres/migration/`

2. Follow naming: `prod_YYYYMMDD_description.sql`

3. Update schema version constant in `store/migrator.go`

4. Test migration locally with all three database drivers

## Common Patterns

### Adding a New API Endpoint

1. Define service method in `proto/api/v1/{service}_service.proto`
2. Run `buf generate` to regenerate code
3. Implement method in `server/router/api/v1/{service}_service.go`
4. Add to public allowlist in `acl_config.go` if unauthenticated
5. Update frontend client in `web/src/`

### Adding a New Data Model

1. Define struct in `store/{model}.go`
2. Add CRUD methods to `store.Driver` interface in `store/driver.go`
3. Implement methods in each driver:
   - `store/db/sqlite/{model}.go`
   - `store/db/mysql/{model}.go`
   - `store/db/postgres/{model}.go`
4. Create migration files for schema changes
5. Add tests in `store/test/{model}_test.go`

### Frontend Data Fetching

Use gRPC-Web client from `web/src/grpcweb.ts`:

```typescript
import { memoServiceClient } from "@/grpcweb";

const response = await memoServiceClient.listMemos({
  filter: "creator == 'users/1'",
});
```

State is typically managed in MobX stores (`web/src/store/`).

## Production Deployment

**Docker (Recommended):**
```bash
docker run -d \
  --name memos \
  -p 5230:5230 \
  -v ~/.memos:/var/opt/memos \
  neosmemo/memos:stable
```

**From Source:**
1. Build frontend: `cd web && pnpm install && pnpm release`
2. Build backend: `go build -o memos ./cmd/memos`
3. Run: `./memos --mode prod --port 5230`

**Data Directory:**
For SQLite (default), all data is stored in the directory specified by `--data` flag. This includes:
- `memos_prod.db` - SQLite database
- `assets/` - Uploaded files (unless using S3-compatible storage)

## Key Dependencies

**Backend:**
- `github.com/spf13/cobra` - CLI framework
- `github.com/spf13/viper` - Configuration management
- `google.golang.org/grpc` - gRPC server
- `github.com/grpc-ecosystem/grpc-gateway/v2` - REST gateway
- `github.com/labstack/echo/v4` - HTTP server
- `github.com/soheilhy/cmux` - Connection multiplexing
- `modernc.org/sqlite` - Pure Go SQLite driver
- `github.com/golang-jwt/jwt/v5` - JWT authentication

**Frontend:**
- `react` / `react-dom` - UI framework
- `react-router-dom` - Routing
- `mobx` / `mobx-react-lite` - State management
- `tailwindcss` - Styling
- `nice-grpc-web` - gRPC-Web client
- `@radix-ui/*` - Headless UI components
- `react-i18next` - Internationalization
