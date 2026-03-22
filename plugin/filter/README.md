# Memo Filter Engine

This package houses the memo-only filter engine that turns CEL expressions into
SQL fragments. The engine follows a three phase pipeline inspired by systems
such as Calcite or Prisma:

1. **Parsing** – CEL expressions are parsed with `cel-go` and validated against
   the memo-specific environment declared in `schema.go`. Only fields that
   exist in the schema can surface in the filter.
2. **Normalization** – the raw CEL AST is converted into an intermediate
   representation (IR) defined in `ir.go`. The IR is a dialect-agnostic tree of
   conditions (logical operators, comparisons, list membership, etc.). This
   step enforces schema rules (e.g. operator compatibility, type checks).
3. **Rendering** – the renderer in `render.go` walks the IR and produces a SQL
   fragment plus placeholder arguments tailored to a target dialect
   (`sqlite`, `mysql`, or `postgres`). Dialect differences such as JSON access,
   boolean semantics, placeholders, and `LIKE` vs `ILIKE` are encapsulated in
   renderer helpers.

The entry point is `filter.DefaultEngine()` from `engine.go`. It lazily constructs
an `Engine` configured with the memo schema and exposes:

```go
engine, _ := filter.DefaultEngine()
stmt, _ := engine.CompileToStatement(ctx, `has_task_list && visibility == "PUBLIC"`, filter.RenderOptions{
	Dialect: filter.DialectPostgres,
})
// stmt.SQL  -> "((memo.payload->'property'->>'hasTaskList')::boolean IS TRUE AND memo.visibility = $1)"
// stmt.Args -> ["PUBLIC"]
```

## Core Files

| File          | Responsibility                                                                  |
| ------------- | ------------------------------------------------------------------------------- |
| `schema.go`   | Declares memo fields, their types, backing columns, CEL environment options     |
| `ir.go`       | IR node definitions used across the pipeline                                    |
| `parser.go`   | Converts CEL `Expr` into IR while applying schema validation                    |
| `render.go`   | Translates IR into SQL, handling dialect-specific behavior                      |
| `engine.go`   | Glue between the phases; exposes `Compile`, `CompileToStatement`, and `DefaultEngine` |
| `helpers.go`  | Convenience helpers for store integration (appending conditions)                |

## SQL Generation Notes

- **Placeholders** — `?` is used for SQLite/MySQL, `$n` for Postgres. The renderer
  tracks offsets to compose queries with pre-existing arguments.
- **JSON Fields** — Memo metadata lives in `memo.payload`. The renderer handles
  `JSON_EXTRACT`/`json_extract`/`->`/`->>` variations and boolean coercion.
- **Tag Operations** — `tag in [...]` and `"tag" in tags` become JSON array
  predicates. SQLite uses `LIKE` patterns, MySQL uses `JSON_CONTAINS`, and
  Postgres uses `@>`.
- **Boolean Flags** — Fields such as `has_task_list` render as `IS TRUE` equality
  checks, or comparisons against `CAST('true' AS JSON)` depending on the dialect.

## Typical Integration

1. Fetch the engine with `filter.DefaultEngine()`.
2. Call `CompileToStatement` using the appropriate dialect enum.
3. Append the emitted SQL fragment/args to the existing `WHERE` clause.
4. Execute the resulting query through the store driver.

The `helpers.AppendConditions` helper encapsulates steps 2–3 when a driver needs
to process an array of filters.
