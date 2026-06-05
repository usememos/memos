# AGENTS.md

Repository instructions for AI coding agents. Keep this file short, concrete, and tied to commands that actually work in this
repo. If a fact here conflicts with source files or CI config, trust the source file and update this guide.

## Project Snapshot

Memos is a self-hosted note-taking app.

- Backend: Go 1.26.2, Echo v5, Connect RPC, gRPC-Gateway, Protocol Buffers.
- Frontend: React 19, TypeScript 6, Vite 8, Tailwind CSS v4, React Query v5.
- Storage: SQLite, MySQL, PostgreSQL.
- Generated API outputs: `proto/gen/` for Go/OpenAPI, `web/src/types/proto/` for TypeScript.

## Working Rules

- Read relevant code before editing; prefer local patterns over new abstractions.
- Keep diffs scoped. Do not do repo-wide cleanup, dependency churn, or generated-file rewrites unless the task requires it.
- Do not hand-edit generated proto outputs. Change `.proto` files, then run `buf generate`.
- Add migrations for all database drivers when schema changes, and update each driver's `LATEST.sql`.
- Add public API endpoints to `server/router/api/v1/acl_config.go`.
- Ask before adding heavy dependencies, changing auth/token behavior, or altering Docker/release workflows.

## Commands

Run from the repository root unless a command starts with `cd`.

```bash
# Backend
go run ./cmd/memos --port 8081    # Start backend dev server
go test ./...                      # Run all Go tests
go test -v ./store/...             # Store tests, including DB drivers via TestContainers
go test -v -race ./server/...      # Server tests with race detector
go test -v -race ./internal/...    # Internal package tests with race detector
go test -v -run TestFoo ./pkg/...  # Run matching Go tests
go mod tidy -go=1.26.2             # Match CI tidy check
golangci-lint run                  # Go lint, config: .golangci.yaml
golangci-lint run --fix            # Auto-fix lint, including goimports

# Frontend
cd web && pnpm install             # Install dependencies
cd web && pnpm dev                 # Dev server on :3001, proxying API to :8081
cd web && pnpm lint                # Type check + Biome lint
cd web && pnpm test                # Vitest unit tests
cd web && pnpm build               # Production build
cd web && pnpm release             # Build SPA into server/router/frontend/dist

# Protocol Buffers
cd proto && buf generate           # Regenerate Go + TypeScript + OpenAPI
cd proto && buf lint               # Lint proto files
cd proto && buf format -w          # Format proto files
```

## Code Map

| Path | Purpose |
| --- | --- |
| `cmd/memos/main.go` | Cobra/Viper CLI setup and server startup |
| `server/server.go` | Echo HTTP server and background runner wiring |
| `server/auth/` | JWT access tokens, refresh tokens, PAT handling |
| `server/router/api/v1/` | Connect/gRPC-Gateway services, ACL config, SSE hub |
| `server/router/frontend/` | Static SPA serving |
| `server/router/fileserver/` | Native HTTP file serving, thumbnails, range requests |
| `server/runner/` | Background memo processing and S3 presign refresh |
| `store/` | Store facade, cache, migrations, driver interface |
| `store/db/{sqlite,mysql,postgres}/` | Database-specific drivers and SQL |
| `proto/api/v1/` | Public API service definitions |
| `proto/store/` | Internal storage proto messages |
| `internal/` | App-private packages: scheduler, cron, email, CEL filter, markdown, idp, S3 |
| `web/src/connect.ts` | Connect RPC clients, auth interceptor, access-token refresh |
| `web/src/auth-state.ts` | Token storage and BroadcastChannel cross-tab sync |
| `web/src/hooks/` | React Query hooks for server state |
| `web/src/contexts/` | React context for client/UI state |
| `web/src/components/` | Radix/Tailwind UI components and feature components |
| `web/src/themes/` | CSS themes using OKLch color tokens |

## Change Routing

| Change | Update | Verify |
| --- | --- | --- |
| Go service or router behavior | Service code under `server/`, tests near package | `go test -v -race ./server/...` |
| Store or migration behavior | `store/`, all three DB driver migrations, `LATEST.sql` | `go test -v ./store/...` |
| Internal package logic | Relevant `internal/` package tests | `go test -v -race ./internal/...` |
| Frontend behavior | Components/hooks/contexts under `web/src/` | `cd web && pnpm lint && pnpm test` |
| Frontend production output | Vite config or release-sensitive UI | `cd web && pnpm build` or `pnpm release` |
| Proto API | `.proto` source plus generated outputs | `cd proto && buf generate && buf lint` |
| Public unauthenticated route | `server/router/api/v1/acl_config.go` | Targeted server test or manual route check |

## Go Conventions

- Wrap errors with `errors.Wrap(err, "context")` from `github.com/pkg/errors`; do not use `fmt.Errorf`.
- Return service errors with `status.Errorf(codes.X, "message")`.
- Keep imports grouped as stdlib, third-party, then `github.com/usememos/memos`; goimports is run by golangci-lint.
- Add doc comments for exported identifiers; godot enforces exported comment punctuation.
- Avoid package-level mutable state unless the surrounding package already uses that pattern.

## Frontend Conventions

- Use `@/` for absolute imports.
- Follow Biome formatting: 2-space indent, double quotes, semicolons, 140-character line width.
- Put server data in React Query hooks under `web/src/hooks/`; keep UI-only state in contexts or component state.
- Use Tailwind CSS v4 utilities, `cn()` for class merging, and CVA for variants.
- Reuse Radix primitives and existing components before adding new UI primitives.
- Keep generated proto TypeScript under `web/src/types/proto/` out of manual edits and Biome rewrites.

## Database And Proto Rules

- Schema changes require SQLite, MySQL, and PostgreSQL migrations plus `LATEST.sql` updates.
- Fresh-install SQL and incremental migrations must stay equivalent.
- Proto field changes must preserve compatibility unless the task explicitly allows a breaking API change.
- Regenerate after proto edits and include both Go/OpenAPI and TypeScript generated outputs.

## Verification Policy

- Run the narrowest relevant checks while iterating.
- Before finishing, run the checks that match the changed surface from "Change Routing".
- For docs-only changes, `git diff --check` is sufficient unless the docs include runnable examples that should be tested.
- If a required check cannot run locally, report the reason and the exact command that remains.

## CI Reference

- Backend CI: Go 1.26.2, `go mod tidy -go=1.26.2`, golangci-lint v2.11.3, test groups `store`, `server`, `internal`, `other`.
- Frontend CI: Node 24, pnpm 11.0.1, `pnpm lint`, `pnpm test`, `pnpm build`.
- Proto CI: `buf lint` and `buf format` check.
- Docker: `scripts/Dockerfile`, Alpine 3.21 runtime, non-root user, port 5230, multi-arch amd64/arm64/arm/v7.
