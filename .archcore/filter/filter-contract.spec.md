---
title: "Memo filter engine"
status: draft
tags:
  - "filter"
---

## Purpose & Scope
This spec defines the SQL generation contract of the filter engine: which CEL expressions compile, and what SQL fragment and arguments each renders to on SQLite, MySQL, and PostgreSQL. It is normative for the parser (@filter/parser.go), the schema (@filter/schema.go), the renderer (@filter/render.go), and the engine entry points (@filter/engine.go, @filter/helpers.go). The store drivers under @store/db, the list endpoints that accept `filter`, and saved views depend on it.
Out of scope: the engine's internal structure and file map (the filter engine reference doc), the procedure for adding fields (the maintenance guide), and read authorization, which filters only narrow.

## Surface
- `filter.DefaultEngine()`, `Engine.Compile`, `Engine.CompileToStatement(ctx, filter, RenderOptions)`, `Statement{SQL, Args}` (@filter/engine.go).
- `RenderOptions.Dialect` with `DialectSQLite` (`sqlite`), `DialectMySQL` (`mysql`), `DialectPostgres` (`postgres`); `RenderOptions.PlaceholderOffset` (@filter/engine.go, @filter/schema.go).
- `filter.AppendConditions(ctx, engine, filters, dialect, where, args)` (@filter/helpers.go).
- Memo fields and CEL variables, including `content`, `created_ts`, `updated_ts`, `tag`, `tags`, `has_task_list`, `has_location`, `now`, and `ext.Sets()` (@filter/schema.go).
- Timestamp accessors: `getFullYear()`, `getMonth()`, `getDate()`, `getDayOfMonth()`, `getDayOfWeek()`, `getDayOfYear()`, `getHours()`, `getMinutes()`, `getSeconds()`.
- SQLite `regexp` function registered in @store/db/sqlite/functions.go.

## Normative Behavior
Parsing and validation
1. WHEN a filter names a field absent from the schema, the engine MUST reject it at compile time.
2. The engine MUST reject non-standard legacy coercions.
3. WHEN normalizing to IR, the engine MUST enforce operator compatibility and type checks from the schema.
4. WHEN a filter uses `field.matches("pattern")`, the engine MUST validate the pattern against Go RE2 at compile time via `cel.ValidateRegexLiterals()`.

Placeholders and JSON
5. The renderer MUST emit `?` placeholders for SQLite and MySQL and `$n` placeholders for PostgreSQL.
6. The renderer MUST number PostgreSQL placeholders after `PlaceholderOffset`, so fragments compose with pre-existing arguments.
7. WHEN a field lives in `memo.payload`, the renderer MUST use the dialect's JSON access (`JSON_EXTRACT`/`json_extract`, `->`/`->>`) and boolean coercion.

Time
8. The engine MUST treat `created_ts`, `updated_ts`, and attachment `create_time` as CEL `timestamp` values.
9. The engine MUST accept instants written with `now`, `duration("…")`, `timestamp("2006-01-02T15:04:05Z")`, and `timestamp(<epoch-seconds>)`.
10. The engine MUST fold those instants to epoch seconds at compile time, leaving the backing columns unchanged.
11. The engine MUST freeze `now` once per compile.
12. Tests MAY inject the `now` value through the engine clock.
13. WHEN a timestamp accessor applies to a column, the renderer MUST emit date-part extraction (`strftime`, `EXTRACT`, or `YEAR`/`MONTH`/… by dialect).
14. The renderer MUST normalize accessor results to CEL's base: 0-based month and 0-based day-of-week with 0 = Sunday.
15. WHEN the same accessors apply to `now`, the engine MUST fold them to literal UTC date parts of the frozen evaluation time.
16. The renderer MUST extract date parts in UTC on SQLite and PostgreSQL; on MySQL the `TIMESTAMP` column reads in the session time zone.

Tags
17. The renderer MUST evaluate `tag in [...]`, `"tag" in tags`, and tag comprehension predicates against individual JSON array elements.
18. The renderer MUST compare tags case-sensitively for equality and string matching, without Unicode normalization.
19. The renderer MUST treat `%` and `_` in tag string operands as literal characters.
20. The renderer MUST match tag hierarchy through implied ancestors present in the memo tag set, never through prefix matching.
21. `tags.all(t, <pred>)` MUST match only non-empty tag sets whose every element satisfies the predicate.
22. `tags.exists_one(t, <pred>)` MUST match when exactly one element satisfies it (`COUNT(...) = 1`).
23. Tag comprehensions MUST iterate per element with `json_each` (SQLite), `jsonb_array_elements_text` (PostgreSQL), or `JSON_TABLE` (MySQL).
24. `sets.contains`, `sets.intersects`, and `sets.equivalent` on `tags` MUST desugar to exact-membership checks (AND or OR of `"v" in tags`).
25. `sets.equivalent` MUST add a `size(tags)` length check, relying on tags being a set.

Flags, strings, sizes, arithmetic
26. The renderer MUST render boolean flags such as `has_task_list` as `IS TRUE` checks or comparisons against `CAST('true' AS JSON)`, by dialect.
27. The renderer MUST render `has_location` as a key-existence check on `memo.payload` at `$.location`.
28. On every dialect, the renderer MUST treat a missing `location` key and an explicit JSON null as absent, and any other value, including `{}`, as present.
29. The engine MUST accept `has_location` only bare, negated, or with `==`/`!=` against a boolean literal.
30. WHEN a field sets `SupportsContains`, the renderer MUST render `contains`, `startsWith`, and `endsWith` as case-insensitive `LIKE` or `ILIKE`.
31. The renderer MUST escape the LIKE metacharacters `%`, `_`, and `\` in string-matching operands.
32. The renderer MUST render `matches` as `~` on PostgreSQL and `REGEXP` on MySQL and SQLite.
33. The renderer MUST render `size(tags)` as JSON array length.
34. The renderer MUST render `size()` on string fields as `LENGTH`, or `CHAR_LENGTH` on MySQL, counting code points.
35. The engine MUST constant-fold `+`, `-`, `*`, `/`, `%` on literal, `now`, and `duration` operands.

Integration
36. `AppendConditions` MUST compile each filter with the current argument count as offset and append the fragment in parentheses to `where`.

## Constraints & Invariants
- `SupportsContains` is set on memo `content` and attachment `filename` and `mime_type`.
- Regex syntax differs per engine: Go RE2 on SQLite, POSIX ERE on PostgreSQL, ICU on MySQL 8.0+; engine-specific patterns may not be portable even though compile-time validation uses RE2.
- Timestamp accessors accept no timezone argument.
- Dialect differences (JSON access, boolean semantics, placeholders, `LIKE` vs `ILIKE`) stay encapsulated in renderer helpers; store code receives a finished fragment.
- Saved filters using `now` accessors re-resolve on every compile.

## Failure Behavior
1. IF a filter fails parsing, schema validation, or regex validation, THEN the engine MUST return an error and no SQL.
2. IF a folded division or modulo has a zero divisor, THEN the engine MUST return a compile error.
3. IF an operator is incompatible with a field's type, THEN the engine MUST reject the filter during normalization.

## Conformance
An implementation is conformant when it satisfies behaviors 1–36, holds the invariants, and follows the failure rules. Per-dialect rendering goldens and SQLite behavioral tests live in @filter/engine_test.go, @filter/functions_test.go, and @filter/time_test.go.
Given `has_task_list && visibility == "PUBLIC"` compiled for `DialectPostgres`,
When `CompileToStatement` runs,
Then SQL is `((memo.payload->'property'->>'hasTaskList')::boolean IS TRUE AND memo.visibility = $1)` and Args is `["PUBLIC"]`.
