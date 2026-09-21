---
title: "Maintaining the filter engine"
status: draft
tags:
  - "filter"
---

Reader: a Go contributor who extends or debugs the filter engine in @filter; the contributor performs every step. Field and behavior changes stay consistent with the schema and the store implementations under @store/db.

## Prerequisites
- Familiarity with the pipeline: @filter/schema.go (fields and CEL environment), @filter/parser.go (CEL to IR), @filter/render.go (IR to SQL), @filter/engine.go (entry points).

## Steps
### Add a new memo field
1. Add the field entry in `schema.go`.
2. Define its backing column (`Column`), its JSON path if applicable, its type, and its allowed operators.
3. Include the CEL variable in `EnvOptions`.
4. For a non-scalar field (JSON booleans, lists), add handling in `parser.go` or extend the renderer helpers.
5. Keep validation in the parser; for example, reject unsupported operators there.
6. Extend `engine_test.go` with per-dialect rendering assertions for the new field.
7. When the semantics warrant it, add a SQLite behavioral test.
8. Run `go test ./...` to ensure the SQL output matches expectations across all dialects.

### Add dialect-specific behavior
1. Put a new dialect-specific behavior, such as JSON operators, inside `render.go` rather than leaking it into store code.
2. Use the renderer helpers (`jsonExtractExpr`, `jsonArrayExpr`, etc.) rather than ad-hoc SQL strings.
3. When placeholders change, adjust `addArg` so argument numbering stays in sync with store queries.

## Verification
Testing checklist:
- `go test ./store/...` ensures all dialect tests consume the engine correctly.
- Add targeted unit tests whenever new IR nodes or renderer paths are introduced.
- When changing boolean or JSON handling, verify all three dialect test suites (SQLite, MySQL, Postgres) to avoid regression.

## Common Issues
- **Parser errors.** Most originate in `buildCondition` (@filter/parser.go) or schema validation. Enable logging around `parser.go` when diagnosing unknown identifier or operator messages.
- **Renderer output.** Temporary printf or log statements in `renderCondition` (@filter/render.go) help identify which IR node produced unexpected SQL.
- **Store integration.** `filter.DefaultEngine()` (@filter/engine.go) is a singleton that caches the parsed CEL environment.
