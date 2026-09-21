---
title: "Verification policy"
status: draft
tags:
  - "conventions"
---

## Rule
1. While iterating on repository changes, contributors MUST run the narrowest relevant checks.
2. Before finishing repository changes, contributors MUST run the checks matching the changed surface in the table below.
3. For docs-only changes without runnable examples needing tests, contributors MAY use `git diff --check` as the sufficient check.
4. When required checks cannot run locally, contributors MUST report the reason and exact unrun command.

## Rationale
The authored workflow maps changed surfaces to checks. Commands are declared in @web/package.json and the backend/frontend workflows under @.github/workflows.

## Examples
Not recorded in the source.

## Enforcement
Not recorded in the source.

## Changed-surface checks
| Change | Update scope | Check |
| --- | --- | --- |
| Go service/router | `server/`, `core/`, nearby tests | `go test -v -race ./server/... ./core/...` |
| Store/migration | `store/`, three migrations and `LATEST.sql` | `go test -v ./store/...` |
| Markdown/filter/provider | Corresponding package | `go test -v -race ./markdown/... ./filter/... ./provider/...` |
| Internal package | Relevant `internal/` tests | `go test -v -race ./internal/...` |
| Frontend behavior | `web/src/` components/hooks/contexts | `cd web && pnpm lint && pnpm test` |
| Frontend production | Vite config/release-sensitive UI | `cd web && pnpm build` or `cd web && pnpm release` |
| Proto API | `.proto` plus generated outputs | `cd proto && buf generate && buf lint` |
| Public unauthenticated route | `server/api/v1/acl_config.go` | Targeted server test or manual route check |
