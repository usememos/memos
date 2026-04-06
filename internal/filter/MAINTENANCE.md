# Maintaining the Memo Filter Engine

The engine is memo-specific; any future field or behavior changes must stay
consistent with the memo schema and store implementations. Use this guide when
extending or debugging the package.

## Adding a New Memo Field

1. **Update the schema**  
   - Add the field entry in `schema.go`.  
   - Define the backing column (`Column`), JSON path (if applicable), type, and
     allowed operators.  
   - Include the CEL variable in `EnvOptions`.
2. **Adjust parser or renderer (if needed)**  
   - For non-scalar fields (JSON booleans, lists), add handling in
     `parser.go` or extend the renderer helpers.  
   - Keep validation in the parser (e.g., reject unsupported operators).
3. **Write a golden test**  
   - Extend the dialect-specific memo filter tests under
     `store/db/{sqlite,mysql,postgres}/memo_filter_test.go` with a case that
     exercises the new field.
4. **Run `go test ./...`** to ensure the SQL output matches expectations across
   all dialects.

## Supporting Dialect Nuances

- Centralize differences inside `render.go`. If a new dialect-specific behavior
  emerges (e.g., JSON operators), add the logic there rather than leaking it
  into store code.
- Use the renderer helpers (`jsonExtractExpr`, `jsonArrayExpr`, etc.) rather than
  sprinkling ad-hoc SQL strings.
- When placeholders change, adjust `addArg` so that argument numbering stays in
  sync with store queries.

## Debugging Tips

- **Parser errors** – Most originate in `buildCondition` or schema validation.
  Enable logging around `parser.go` when diagnosing unknown identifier/operator
  messages.
- **Renderer output** – Temporary printf/log statements in `renderCondition` help
  identify which IR node produced unexpected SQL.
- **Store integration** – Ensure drivers call `filter.DefaultEngine()` exactly once
  per process; the singleton caches the parsed CEL environment.

## Testing Checklist

- `go test ./store/...` ensures all dialect tests consume the engine correctly.
- Add targeted unit tests whenever new IR nodes or renderer paths are introduced.
- When changing boolean or JSON handling, verify all three dialect test suites
  (SQLite, MySQL, Postgres) to avoid regression.
