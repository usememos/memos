# AGENTS.md

Repository instructions for AI coding agents. Keep this file short, concrete, and tied to commands that actually work in this
repo. If a fact here conflicts with source files or CI config, trust the source file and update this guide.

## Project Snapshot

Memos is a note-taking app, migrated from a self-hosted Go server to **Cloudflare Workers**.

- Backend: TypeScript on Cloudflare Workers, Connect-RPC, D1 (SQLite), R2 (attachments), Workers Static Assets.
- Frontend: React 19, TypeScript 6, Vite 8, Tailwind CSS v4, React Query v5.
- Auth: Cloudflare Access (JWT verified via JWKS). No built-in password/OAuth/session auth — see `worker/README.md`.
- Generated API outputs: `worker/src/gen/` for the Worker, `web/src/types/proto/` for the frontend — both from `proto/`.

There is no Go code, no Docker image, and no self-hosted deploy path anymore. `worker/README.md` is the source of truth for
architecture, local dev, and deployment (including the Cloudflare Access setup).

## Working Rules

- Read relevant code before editing; prefer local patterns over new abstractions.
- Keep diffs scoped. Do not do repo-wide cleanup, dependency churn, or generated-file rewrites unless the task requires it.
- Do not hand-edit generated proto outputs (`worker/src/gen/`, `web/src/types/proto/`). Change `.proto` files, then regenerate.
- Schema changes: add a new numbered migration under `worker/migrations/`. There is only one driver (D1/SQLite) now.
- Ask before adding heavy dependencies, changing auth behavior, or altering the Cloudflare Access model.
- One-off personal/production data imports belong in `worker/seed/`, never in `worker/migrations/` — that directory is also
  scanned by `worker/vitest.config.ts` to seed the test D1, so a data-import script there leaks real data into every test run.

## Commands

Run from the repository root unless a command starts with `cd`.

```bash
# Worker (backend)
cd worker && npm install               # Install dependencies
cd worker && npm run gen               # Regenerate TS proto types into src/gen/
cd worker && npm run dev               # wrangler dev, http://localhost:8787
cd worker && npm run typecheck         # tsc --noEmit
cd worker && npm test                  # vitest with @cloudflare/vitest-pool-workers (real D1/R2)
cd worker && npm run db:migrate:local  # Apply migrations to local D1
cd worker && npm run db:migrate:remote # Apply migrations to production D1
cd worker && npx wrangler deploy       # Deploy the Worker (requires web/dist built first)

# Frontend
cd web && pnpm install             # Install dependencies
cd web && pnpm dev                 # Dev server on :3001, proxying API to :8787 (wrangler dev)
cd web && pnpm lint                # Type check + Biome lint
cd web && pnpm test                # Vitest unit tests
cd web && pnpm build               # Production build
cd web && pnpm release             # Build SPA into web/dist (served by the Worker's assets binding)

# Protocol Buffers
cd proto && buf generate           # Regenerate TypeScript (frontend types only; run `npm run gen` in worker/ separately)
cd proto && buf lint               # Lint proto files
cd proto && buf format -w          # Format proto files
```

## Code Map

| Path | Purpose |
| --- | --- |
| `worker/src/index.ts` | Fetch handler entry point: routes to Connect-RPC, `/file`, RSS/sitemap, `/mcp`, or static assets |
| `worker/src/auth/` | Cloudflare Access JWT verification and per-request auth context |
| `worker/src/services/` | Connect-RPC service implementations (memo, user, instance, attachment, shortcut, ai, auth) |
| `worker/src/store/` | D1 query layer (parameterized SQL, no ORM) |
| `worker/src/filter/` | CEL-subset parser and SQL renderer for memo/attachment filters |
| `worker/src/markdown/` | Tag/mention/property extraction (port of the old Go markdown service) |
| `worker/src/routes/` | `/file` (R2 streaming), RSS/sitemap, `/mcp` |
| `worker/src/lib/` | Webhooks, email (Resend), notifications |
| `worker/migrations/` | D1 schema migrations, applied via `wrangler d1 migrations apply` |
| `worker/seed/` | One-off, git-ignored personal data import scripts — not part of the migration chain |
| `worker/test/` | Vitest integration tests (stage1–5, filter, access) |
| `proto/api/v1/` | Public API service definitions |
| `proto/store/` | Internal storage proto messages (used for JSON-encoded D1 payload columns) |
| `web/src/connect.ts` | Connect RPC clients (no token/refresh logic — Access handles auth via cookie) |
| `web/src/contexts/AuthContext.tsx` | Current-user state; sign-out redirects to Access's logout endpoint |
| `web/src/router/guards.tsx` | `LandingRoute`, `RequireAuthRoute` (full-page reload to trigger Access login) |
| `web/src/hooks/` | React Query hooks for server state |
| `web/src/contexts/` | React context for client/UI state |
| `web/src/components/` | Radix/Tailwind UI components and feature components |
| `web/src/themes/` | CSS themes using OKLch color tokens |

## Change Routing

| Change | Update | Verify |
| --- | --- | --- |
| Worker service behavior | `worker/src/services/`, tests in `worker/test/` | `cd worker && npm test` |
| D1 schema | New file under `worker/migrations/` | `npm run db:migrate:local && npm test` |
| CEL filter behavior | `worker/src/filter/` | `cd worker && npx vitest run test/filter.test.ts` |
| Markdown extraction | `worker/src/markdown/` | `cd worker && npx vitest run test/filter.test.ts` |
| Frontend behavior | Components/hooks/contexts under `web/src/` | `cd web && pnpm lint && pnpm test` |
| Frontend production output | Vite config or release-sensitive UI | `cd web && pnpm build` or `pnpm release` |
| Proto API | `.proto` source plus generated outputs | `cd proto && buf generate && buf lint`, then `cd worker && npm run gen` |
| Access/auth behavior | `worker/src/auth/`, `worker/README.md` | `cd worker && npx vitest run test/access.test.ts test/stage2.test.ts` |

## Frontend Conventions

- Use `@/` for absolute imports.
- Follow Biome formatting: 2-space indent, double quotes, semicolons, 140-character line width.
- Put server data in React Query hooks under `web/src/hooks/`; keep UI-only state in contexts or component state.
- Use Tailwind CSS v4 utilities, `cn()` for class merging, and CVA for variants.
- Reuse Radix primitives and existing components before adding new UI primitives.
- Keep generated proto TypeScript under `web/src/types/proto/` out of manual edits and Biome rewrites.

## Worker Conventions

- Use `ConnectError` with a `Code` from `@connectrpc/connect` for RPC failures; never throw plain `Error` from a service method.
- `requireUser`/`requireAdmin` (in `worker/src/services/context.ts`) are the standard authorization guards — call them at the
  top of any RPC that needs an identity, matching how the old Go server checked `fetchCurrentUser`.
- D1 has no interactive transactions — use `db.batch([...])` for multi-statement writes that must be atomic.
- Keep the same JSON shape in `payload` columns (memo/attachment) as the `storepb` protos — they're read by both old and new
  rows and by `toJsonString`/`fromJsonString` from `@bufbuild/protobuf`.

## Database And Proto Rules

- D1 is the only backing store now (previously SQLite/MySQL/PostgreSQL were all supported in Go).
- Proto field changes must preserve compatibility unless the task explicitly allows a breaking API change.
- Regenerate both `worker/src/gen/` (`cd worker && npm run gen`) and `web/src/types/proto/` (`cd proto && buf generate`) after
  editing `.proto` files.

## Verification Policy

- Run the narrowest relevant checks while iterating.
- Before finishing, run the checks that match the changed surface from "Change Routing".
- For docs-only changes, `git diff --check` is sufficient unless the docs include runnable examples that should be tested.
- If a required check cannot run locally, report the reason and the exact command that remains.

## CI Reference

- Frontend CI: Node 24, pnpm 11.0.1, `pnpm lint`, `pnpm test`, `pnpm build` (`.github/workflows/frontend-tests.yml`).
- Proto CI: `buf lint` and `buf format` check (`.github/workflows/proto-linter.yml`).
- There is no backend/Docker/release CI — deployment is `cd worker && npx wrangler deploy`, done manually or from a workflow
  you add yourself.
