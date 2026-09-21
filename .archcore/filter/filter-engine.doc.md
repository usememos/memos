---
title: "Filter engine reference"
status: draft
tags:
  - "filter"
---

## Overview
The filter engine in @filter turns standard CEL filter expressions into SQL fragments for the subset of expressions the schema supports. It follows a three-phase pipeline in the style of Calcite or Prisma: parse CEL, normalize to a dialect-agnostic intermediate representation (IR), and render SQL with placeholder arguments for one target dialect (`sqlite`, `mysql`, or `postgres`). Store drivers (@store/db) and API filter checks (@server/api/v1/filter_access.go) call it.

## Content
### Pipeline
1. **Parsing** — `cel-go` parses the expression and validates it against the environment declared in @filter/schema.go. Only schema fields can appear in a filter.
2. **Normalization** — @filter/parser.go converts the CEL AST into the IR defined in @filter/ir.go: a tree of conditions (logical operators, comparisons, list membership, and related nodes). Schema rules such as operator compatibility and type checks apply here.
3. **Rendering** — @filter/render.go walks the IR and produces a SQL fragment plus arguments for the target dialect. Renderer helpers hold dialect differences: JSON access, boolean semantics, placeholders, and `LIKE` vs `ILIKE`.

### Core files
| File | Responsibility |
| --- | --- |
| @filter/schema.go | Declares fields, their types, backing columns, and CEL environment options |
| @filter/ir.go | IR node definitions used across the pipeline |
| @filter/parser.go | Converts CEL `Expr` into IR while applying schema validation |
| @filter/render.go | Translates IR into SQL, handling dialect-specific behavior |
| @filter/engine.go | Glue between the phases; exposes `Compile`, `CompileToStatement`, and `DefaultEngine` |
| @filter/helpers.go | Store-integration helpers that append conditions |

### Entry points
- `filter.DefaultEngine()` lazily constructs the process-wide `Engine` with the memo schema, once per process through `sync.Once` (@filter/engine.go).
- `filter.DefaultAttachmentEngine()` does the same for the attachment schema (`filename`, `mime_type`, `create_time`).
- `CompileToStatement(ctx, filter, RenderOptions{Dialect: …})` returns a `Statement` with `SQL` and `Args`.

### Typical integration
1. Fetch the engine with `filter.DefaultEngine()`.
2. Call `CompileToStatement` with the dialect enum of the driver.
3. Append the emitted SQL fragment and arguments to the existing `WHERE` clause.
4. Execute the resulting query through the store driver.

`filter.AppendConditions` covers steps 2–3 when a driver processes an array of filters; call sites include @store/db/sqlite/memo.go, @store/db/mysql/memo.go, and @store/db/postgres/memo.go.

### Package layering
@filter/doc.go records that `filter` imports only third-party packages and `internal`, and never `store`, `core`, or `server`; the SQL drivers import `filter`, not the reverse.

## Examples
Compiling a combined boolean-flag and visibility filter for PostgreSQL:

```go
engine, _ := filter.DefaultEngine()
stmt, _ := engine.CompileToStatement(ctx, `has_task_list && visibility == "PUBLIC"`, filter.RenderOptions{
	Dialect: filter.DialectPostgres,
})
// stmt.SQL  -> "((memo.payload->'property'->>'hasTaskList')::boolean IS TRUE AND memo.visibility = $1)"
// stmt.Args -> ["PUBLIC"]
```

The same expression on SQLite or MySQL renders `?` placeholders and `JSON_EXTRACT` access instead of `$1` and `->`/`->>`.
