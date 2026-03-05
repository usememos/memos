# CLAUDE.md

Memos — self-hosted knowledge management platform. Go 1.25 backend, React 18 + TypeScript + Vite 7 frontend, Protocol Buffers API.

See `AGENTS.md` for full architecture, workflows, and patterns.

## Essential Commands

### Backend

```bash
go run ./cmd/memos --port 8081    # Start dev server
go test ./...                      # Run all tests
golangci-lint run                  # Lint
goimports -w .                     # Format imports
```

### Frontend

```bash
cd web && pnpm install             # Install deps
pnpm dev                           # Dev server (proxies to :8081)
pnpm lint                          # Type check + Biome lint
pnpm lint:fix                      # Auto-fix lint issues
pnpm format                        # Format code
pnpm build                         # Production build
```

### Protocol Buffers

```bash
cd proto && buf generate            # Regenerate Go + TypeScript
cd proto && buf lint                # Lint proto files
```

## Key Rules

- **Go errors:** Use `errors.Wrap(err, "context")` from `github.com/pkg/errors`. Never use `fmt.Errorf`.
- **Go imports:** stdlib → third-party → local (`github.com/usememos/memos`). Run `goimports -w .`.
- **Go comments:** All exported functions must have doc comments (godot enforced).
- **Go gRPC errors:** Return `status.Errorf(codes.X, "message")` from service methods.
- **Frontend imports:** Use `@/` alias for absolute imports.
- **Frontend formatting:** Biome — 140 char lines, double quotes, always semicolons, 2-space indent.
- **Frontend state:** Server data via React Query hooks (`web/src/hooks/`). Client state via React Context.
- **Database changes:** Must provide migration files for all 3 drivers (sqlite, mysql, postgres) and update `LATEST.sql`.
- **Proto changes:** Run `buf generate` after editing `.proto` files. Generated code is in `proto/gen/` and `web/src/types/proto/`.
- **Public endpoints:** Add to `server/router/api/v1/acl_config.go`.
