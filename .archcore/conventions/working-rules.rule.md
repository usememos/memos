---
title: "Scoped changes and package boundaries"
status: draft
tags:
  - "conventions"
---

## Rule
1. Before editing repository files, contributors MUST read the relevant code.
2. For repository changes, contributors SHOULD prefer local patterns over new abstractions.
3. For repository tasks, contributors MUST keep changes scoped to the task.
4. Unless required by the task, contributors MUST NOT perform repository-wide cleanup, dependency churn, or generated-file rewrites.
5. Before adding heavy dependencies, contributors MUST ask the user.
6. Before changing authentication or token behavior, contributors MUST ask the user.
7. Before altering Docker or release workflows, contributors MUST ask the user.
8. When adding public API endpoints, contributors MUST register them in `server/api/v1/acl_config.go`.
9. Before adding code to a root folder, contributors MUST read its `doc.go` or `README.md`.
10. For Go package imports, contributors MUST preserve the downward dependency boundaries specified below.
11. Except `internal/testutil` importing `proto/gen`, packages under `internal/` MUST NOT import other packages from this module.
12. For new `internal/` packages, contributors MUST restrict contents to code publishable unchanged as a standalone module.
13. When code knows Memo, Space, or instance-setting concepts, contributors MUST place it in a root package.
14. For new Go packages, contributors MUST NOT use names `util`, `common`, `base`, `helpers`, `misc`, or `pkg`.
15. For new Go code, contributors MUST name its package for its responsibility or place it beside its only caller.
16. In `server/api/v1/`, contributors MUST keep handlers thin; business rules go to `core/`.
17. When extracting business rules from `server/api/v1/`, contributors MUST use `core/<resource>/`, one package per resource.
18. For RPC handlers in `server/api/v1/`, contributors MUST extend the matching `<resource>_service.go` file.
19. For store–proto conversions in `server/api/v1/`, contributors MUST use `<resource>_service_converters.go`.
20. For further service splits, contributors MUST use `<resource>_service_<topic>.go`.
21. For service splits, contributors MUST NOT add `*_helpers2.go` files.
22. For service tests, contributors MUST put black-box tests in `server/api/v1/test/` and unit tests beside their code.
23. When repository instructions contradict source or CI configuration, contributors MUST follow the source/configuration and update the instructions.

## Rationale
Every root folder is named for what it holds. Other rationale: Not recorded in the source.

## Examples
Not recorded in the source.

## Enforcement
The layering rules are enforced by `depguard` in @.golangci.yaml. Enforcement of the other clauses is not recorded in the source.

## Dependency boundaries
Imports point downward only: `cmd` → `server` → `core` → `store` → {`provider`, `markdown`, `filter`} → `internal`.

| Layer | Allowed lower dependencies |
| --- | --- |
| `cmd/memos/` | Any application package |
| `server/` | `core`, `store`, `provider`, `markdown`, `filter`, `internal` |
| `core/` | `store`, `provider`, `markdown`, `filter`, `internal` |
| `store/` | `provider`, `markdown`, `filter`, `internal` |
| `markdown/` | `proto/gen`, `internal` |
| `filter/` | `internal` |
| `provider/` | `proto/gen`, `internal` |
| `internal/` | Third-party dependencies; the stated `internal/testutil` exception applies |
