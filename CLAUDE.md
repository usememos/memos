# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Memos is a self-hosted note-taking and knowledge management platform with a Go backend and React/TypeScript frontend. The architecture follows clean separation of concerns with gRPC APIs, REST gateway, and database abstraction.

## Development Commands

### Backend (Go)
```bash
# Run in development mode
go run ./bin/memos/main.go --mode dev --port 8081

# Build binary
go build -o ./build/memos ./bin/memos/main.go
# OR use build script
./scripts/build.sh

# Run tests
go test -v ./...
go test -cover ./...

# Run specific test packages
go test -v ./store/test/
go test -v ./server/router/api/v1/test/
```

### Frontend (React/TypeScript)
```bash
cd web/

# Development server (http://localhost:3001)
pnpm dev

# Build for production
pnpm build

# Build for release (outputs to server/router/frontend/dist)
pnpm release

# Lint and type check
pnpm lint
```

### Full Development Setup
1. **Backend**: `go run ./bin/memos/main.go --mode dev --port 8081`
2. **Frontend**: `cd web && pnpm dev`
3. **Access**: Backend API at `http://localhost:8081`, Frontend at `http://localhost:3001`

## Architecture Overview

### Backend Structure
- **`/bin/memos/main.go`** - Application entrypoint with CLI and server initialization
- **`/server/`** - HTTP/gRPC server with Echo framework and cmux for protocol multiplexing
- **`/server/router/api/v1/`** - gRPC services with REST gateway via grpc-gateway
- **`/store/`** - Data access layer with multi-database support (SQLite/PostgreSQL/MySQL)
- **`/store/db/`** - Database-specific implementations with shared interface
- **`/proto/`** - Protocol buffer definitions for APIs and data models
- **`/internal/`** - Shared utilities, profile management, and version handling
- **`/plugin/`** - Modular plugins (S3 storage, OAuth, webhooks, etc.)

### Frontend Structure
- **`/web/src/`** - React/TypeScript application
- **`/web/src/components/`** - Reusable UI components with shadcn/ui
- **`/web/src/pages/`** - Page-level components
- **`/web/src/store/`** - MobX state management
- **`/web/src/types/`** - TypeScript type definitions generated from protobuf

### Key Architecture Patterns

#### Server Architecture
- **Protocol Multiplexing**: Single port serves both HTTP and gRPC via cmux
- **gRPC-first**: Core APIs defined in protobuf, REST via grpc-gateway
- **Layered**: Router → Service → Store → Database
- **Middleware**: Authentication, logging, CORS handled via interceptors

#### Database Layer
- **Multi-database**: Unified interface for SQLite, PostgreSQL, MySQL
- **Migration System**: Version-based schema migrations in `/store/migration/`
- **Driver Pattern**: `/store/db/{sqlite,postgres,mysql}/` with common interface
- **Caching**: Built-in cache layer for workspace settings, users, user settings

#### Authentication & Security
- **JWT-based**: Secret key generated per workspace
- **gRPC Interceptors**: Authentication middleware for all API calls
- **Context Propagation**: User context flows through request lifecycle
- **Development vs Production**: Different secret handling based on mode

## Database Operations

### Supported Databases
- **SQLite** (default): `--driver sqlite --data ./data`
- **PostgreSQL**: `--driver postgres --dsn "postgres://..."`
- **MySQL**: `--driver mysql --dsn "user:pass@tcp(host:port)/db"`

### Migration System
- Database schema managed via `/store/migration/{sqlite,postgres,mysql}/`
- Automatic migration on startup via `store.Migrate(ctx)`
- Version-based migration files (e.g., `0.22/00__memo_tags.sql`)

## Testing Approach

### Backend Testing
- **Store Tests**: `/store/test/*_test.go` with in-memory SQLite
- **API Tests**: `/server/router/api/v1/test/*_test.go` with full service setup
- **Test Helpers**: 
  - `NewTestingStore()` for isolated database testing
  - `NewTestService()` for API integration testing
- **Test Patterns**: Context-based authentication, proper cleanup, realistic data

### Frontend Testing
- Currently relies on TypeScript compilation and ESLint
- No dedicated test framework configured

### Running Tests
```bash
# All tests
go test -v ./...

# Specific packages
go test -v ./store/test/
go test -v ./server/router/api/v1/test/

# With coverage
go test -cover ./...
```

## Development Modes

### Production Mode
```bash
go run ./bin/memos/main.go --mode prod --port 5230
```
- Uses workspace-generated secret key
- Serves built frontend from `/server/router/frontend/dist/`
- Optimized for deployment

### Development Mode  
```bash
go run ./bin/memos/main.go --mode dev --port 8081
```
- Fixed secret key "usememos"
- Enables debugging features
- Separate frontend development server recommended

### Demo Mode
```bash
go run ./bin/memos/main.go --mode demo
```
- Specialized configuration for demonstration purposes

## Key Configuration

### Environment Variables
All CLI flags can be set via environment variables with `MEMOS_` prefix:
- `MEMOS_MODE` - Server mode (dev/prod/demo)
- `MEMOS_PORT` - Server port
- `MEMOS_DATA` - Data directory
- `MEMOS_DRIVER` - Database driver
- `MEMOS_DSN` - Database connection string
- `MEMOS_INSTANCE_URL` - Public instance URL

### Runtime Configuration
- **Profile**: `/internal/profile/` handles configuration validation
- **Secrets**: Auto-generated workspace secret in production
- **Data Directory**: Configurable storage location for SQLite and assets

## Frontend Technology Stack

### Core Framework
- **React 18** with TypeScript
- **Vite** for build tooling and development server
- **React Router** for navigation
- **MobX** for state management

### UI Components
- **Radix UI** primitives for accessibility
- **Tailwind CSS** for styling with custom themes
- **Lucide React** for icons
- **shadcn/ui** component patterns

### Key Libraries
- **dayjs** for date manipulation
- **highlight.js** for code syntax highlighting
- **katex** for math rendering
- **mermaid** for diagram rendering
- **react-leaflet** for maps
- **i18next** for internationalization

## Protocol Buffer Workflow

### Code Generation
- **Source**: `/proto/api/v1/*.proto` and `/proto/store/*.proto`
- **Generated**: `/proto/gen/` for Go, `/web/src/types/proto/` for TypeScript
- **Build Tool**: Buf for protobuf compilation
- **API Docs**: Generated swagger at `/proto/gen/apidocs.swagger.yaml`

### API Design
- gRPC services in `/proto/api/v1/`
- Resource-oriented design (User, Memo, Attachment, etc.)
- REST gateway auto-generated from protobuf annotations

## File Organization Principles

### Backend
- **Domain-driven**: Each entity (user, memo, attachment) has dedicated files
- **Layered**: Clear separation between API, business logic, and data layers
- **Database-agnostic**: Common interfaces with driver-specific implementations

### Frontend  
- **Component-based**: Reusable components in `/components/`
- **Feature-based**: Related functionality grouped together
- **Type-safe**: Strong TypeScript integration with generated protobuf types

## Common Development Workflows

### Adding New API Endpoint
1. Define service method in `/proto/api/v1/{service}.proto`
2. Generate code: `buf generate` 
3. Implement service method in `/server/router/api/v1/{service}_service.go`
4. Add any required store methods in `/store/{entity}.go`
5. Update database layer if needed in `/store/db/{driver}/{entity}.go`

### Database Schema Changes
1. Create migration file in `/store/migration/{driver}/{version}/`
2. Update store interface in `/store/{entity}.go`
3. Implement in each database driver
4. Update protobuf if external API changes needed

### Frontend Component Development
1. Create component in `/web/src/components/`
2. Follow existing patterns for styling and state management
3. Use TypeScript for type safety
4. Import and use in pages or other components