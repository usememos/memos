# Repository Guidelines

## Project Structure & Module Organization
Memos pairs a Go backend with a Vite React client. The CLI entry in `cmd/memos` boots the HTTP server under `server`, backed by shared domain logic in `internal` and persistence adapters in `store`. Frontend code lives in `web/src` with static assets in `web/public`; `pnpm release` publishes bundles into `server/router/frontend/dist`. API schemas sit in `proto/` (Buf-managed), extensions in `plugin/`, deployment helpers in `scripts/`, and sample SQLite databases in `build/`.

## Build, Test, and Development Commands
- `go run ./cmd/memos --mode dev --port 8081` – start the backend with the default SQLite store.
- `go build ./cmd/memos` – compile the backend binary.
- `go test ./...` – run Go unit and store tests.
- `cd web && pnpm install` – install frontend dependencies.
- `cd web && pnpm dev` – start the Vite dev server with hot reload.
- `cd web && pnpm build` – emit production assets; `pnpm release` copies them to the Go server.
- `cd web && pnpm lint` – type-check and enforce ESLint/Prettier.

## Coding Style & Naming Conventions
Go code must stay `gofmt`-clean (tabs, import grouping) and keep packages lowercase. Prefer context-aware functions and wrap errors with `%w` when bubbling them. Frontend components use PascalCase filenames, hooks stay in camelCase, and Tailwind utilities live alongside components. Prettier (see `web/.prettierrc.js`) governs formatting and import ordering—skip manual tweaks. Update translation keys in `web/src/i18n` whenever UI text changes.

## Testing Guidelines
Place Go tests in `_test.go` siblings and prefer table-driven cases for store behaviours and REST handlers. Run `go test ./...` before pushing and extend coverage when touching migrations or API contracts. The frontend currently leans on linting and manual checks—attach before/after screenshots for UI work and add Go smoke tests when endpoints change.

## Commit & Pull Request Guidelines
Follow the Conventional Commit prefixes visible in history (`feat:`, `fix:`, `chore:`) and keep scopes concise (`feat(server): ...`). Reference linked issues in the body and describe observed impact plus testing performed. Pull requests should summarize the change, note schema or config migrations, include screenshots for UI updates, and flag follow-up tasks so reviewers can plan rollout.

## Security & Configuration Notes
Backend flags and `MEMOS_*` environment variables configure ports, database drivers, and instance URLs—mirror production defaults for security-sensitive work. Review `SECURITY.md` before handling vulnerability fixes and avoid committing secrets; keep `.env.local` files out of version control.
