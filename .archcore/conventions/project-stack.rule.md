---
title: "Project stack"
status: draft
tags:
  - "conventions"
  - "stack"
---

## Rule
1. For Go dependency maintenance, contributors MUST use `go mod tidy -go=1.27.0` to match CI.

## Rationale
The Go toolchain is pinned in @go.mod and @.github/workflows/backend-tests.yml; frontend commands are declared in @web/package.json.

## Examples
### Good
```text
go mod tidy -go=1.27.0
```

## Enforcement
Backend CI runs `go mod tidy -go=1.27.0` (@.github/workflows/backend-tests.yml).

## Stack facts
Backend: Go 1.27.0, Echo v5, Connect RPC, gRPC-Gateway, Protocol Buffers (@go.mod).
Frontend: React 19, Vite 8, Tailwind CSS v4, React Query v5 (@web/package.json).
Storage drivers: SQLite, MySQL, PostgreSQL (@store/db).
Generated outputs: Go/OpenAPI in @proto/gen; TypeScript in @web/src/types/proto.
CI pins Node 24 and pnpm 11.0.1 (@.github/workflows/frontend-tests.yml), and golangci-lint v2.13.1 (@.github/workflows/backend-tests.yml).
