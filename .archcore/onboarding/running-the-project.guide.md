---
title: "Running the project locally"
status: draft
tags:
  - "onboarding"
---

Reader: a contributor with a fresh checkout. Task: run, test, lint, and build Memos locally. Actor: the contributor, from the repository root unless a step starts with `cd`.

## Prerequisites

- Go 1.27.0 (@go.mod)
- Node.js `>=24` and `pnpm@11.0.1` (`engines`, `packageManager` in @web/package.json)
- golangci-lint v2.13.1, the version pinned in @.github/workflows/backend-tests.yml
- buf, for Protocol Buffers work (@proto/buf.gen.yaml); no version is pinned
- A container runtime usable by `testcontainers-go`, for MySQL and PostgreSQL store tests (@store/test/containers.go)

## Steps

### Run

1. Start the backend dev server: `go run ./cmd/memos --port 8081`.
2. Install frontend dependencies: `cd web && pnpm install`.
3. Start the frontend dev server on `:3001`, proxying the API to `:8081`: `cd web && pnpm dev`.

### Test and lint the backend

4. Run all Go tests: `go test ./...`.
5. Run store tests, including all DB drivers through TestContainers: `go test -v ./store/...`.
6. Run server tests with the race detector: `go test -v -race ./server/...`.
7. Run internal package tests with the race detector: `go test -v -race ./internal/...`.
8. Run matching Go tests in one tree: `go test -v -run TestFoo ./core/...`.
9. Match the CI tidy check: `go mod tidy -go=1.27.0`.
10. Run the Go linter, configured in @.golangci.yaml with `depguard` layering rules: `golangci-lint run`.
11. Auto-fix lint findings, including goimports: `golangci-lint run --fix`.

### Test, lint, and build the frontend

12. Type check and run Biome lint: `cd web && pnpm lint`.
13. Run Vitest unit tests: `cd web && pnpm test`.
14. Build for production: `cd web && pnpm build`.
15. Build the SPA into `server/frontend/dist`: `cd web && pnpm release`.

### Protocol Buffers

16. Regenerate Go, TypeScript, and OpenAPI outputs: `cd proto && buf generate`.
17. Lint proto files: `cd proto && buf lint`.
18. Format proto files: `cd proto && buf format -w`.

## Verification

- The backend listens on port 8081; `pnpm dev` serves the SPA at `http://localhost:3001`, proxying the API to it (@web/vite.config.mts).
- Backend CI runs the tidy check, golangci-lint v2.13.1, and four test groups: `store`, `server`, `internal`, and `other` (`cmd`, `core`, `markdown`, `filter`, `provider`, `proto`) (@.github/workflows/backend-tests.yml). Steps 5–9 reproduce them locally.
- Frontend CI runs `pnpm lint`, `pnpm test`, and `pnpm build` on Node 24 with pnpm 11.0.1 (@.github/workflows/frontend-tests.yml).
- Proto CI runs `buf lint` and a `buf format` check (@.github/workflows/proto-linter.yml).

## Common Issues

- **API requests from `:3001` fail.** The backend is not running on `:8081`. Start step 1.
- **Store tests fail or run long.** `./store/...` exercises SQLite, MySQL, and PostgreSQL through TestContainers. Start the container runtime before running step 5.
- **Backend CI fails after the tidy step.** Run step 9 and commit the `go.mod` and `go.sum` changes.
- **Proto CI reports unformatted files.** Run step 18 and commit the result.
- **The backend serves an outdated SPA.** `server/frontend/dist` is embedded with `go:embed` (@server/frontend/frontend.go). Run step 15, then restart the backend.
- **The Docker image does not answer on 8081.** @scripts/Dockerfile builds an Alpine 3.21 runtime with a non-root user that listens on port 5230; release images are built for `linux/amd64`, `linux/arm64`, and `linux/arm/v7`.
