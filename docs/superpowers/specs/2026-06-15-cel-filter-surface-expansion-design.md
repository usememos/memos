# Design: Expand the CEL filter surface

- **Date:** 2026-06-15
- **Status:** Approved (design); ready for implementation planning
- **Area:** `internal/filter` (memo & attachment filter engine)
- **Follow-up spec:** CEL engine hardening + native-AST migration (separate, sequenced after this)

## Summary

memos lets API clients pass a CEL expression in the `filter` field of list
requests. The `internal/filter` engine uses `cel-go` purely as a **parse +
type-check frontend**, then walks the AST and translates it into a SQL `WHERE`
fragment for the active dialect (SQLite / MySQL / Postgres). cel-go never
evaluates anything.

This spec adds three new CEL constructs that users can write, each with a SQL
translation across all three dialects:

1. `startsWith()` / `endsWith()` on scalar string fields (case-insensitive).
2. `all()` comprehension on tag lists (matches only non-empty tag sets).
3. `matches(regex)` on string fields.

## Goals

- Expose the three constructs above through the existing
  parse → IR → render pipeline.
- Keep parity across SQLite, MySQL, and Postgres, with golden tests for each.
- Preserve the engine's invariant: only schema-declared fields and explicitly
  supported operations are accepted; everything else is rejected with a clear
  error.

## Non-goals

- **Value-producing CEL features with no SQL form** are explicitly out of scope:
  optional types (`?.`, `optional.of`), `map()` / `filter()` transforms, the
  math extension, string-manipulation extensions (`replace`, `split`,
  `substring`, `format`), and two-variable comprehensions. There is nothing to
  push into a `WHERE` clause for these.
- **`lowerAscii()` / `upperAscii()`** — dropped. `contains()` is already
  case-insensitive on all dialects, and the new `startsWith`/`endsWith` are
  case-insensitive too (see decisions), so explicit case-folding adds little.
  Revisit only if users ask.
- **Parser hardening and the native-AST proto migration** are a separate
  follow-up spec. The one exception that rides along here is
  `cel.ValidateRegexLiterals()`, which feature ③ requires for safety.

## Background: how the engine works today

Pipeline (see `internal/filter/README.md`):

1. **Parse** — `env.Compile(filter)` parses and type-checks against the
   memo/attachment environment declared in `schema.go`; the AST is converted via
   `cel.AstToParsedExpr()`.
2. **Normalize** — `parser.go` walks the CEL `Expr` and builds a
   dialect-agnostic IR (`ir.go`): logical ops, comparisons, `IN`, `contains()`,
   and `exists()` comprehensions over tag lists.
3. **Render** — `render.go` walks the IR and emits dialect-specific SQL plus
   placeholder args.

Two existing facts that shaped this design:

- **`contains()` is already case-insensitive** on all three dialects
  (`render.go` `renderContainsCondition`): SQLite uses the custom
  `memos_unicode_lower` function, Postgres uses `ILIKE`, MySQL relies on its
  default case-insensitive collation.
- **Custom SQLite scalar functions are already registered**
  (`store/db/sqlite/functions.go`, `ensureUnicodeLowerRegistered` via
  `modernc.org/sqlite`'s `RegisterScalarFunction`, invoked from
  `store/db/sqlite/sqlite.go`). The new `REGEXP` function follows this exact
  pattern.

cel-go version: `v0.28.0` (latest is `v0.28.1`, a patch with nothing relevant to
memos). No version bump is required for this work.

## Resolved decisions

| # | Decision | Choice |
|---|----------|--------|
| A | Case-sensitivity of new scalar `startsWith`/`endsWith` | **Case-insensitive**, consistent with existing `contains()`. `==` stays case-sensitive (exact match). |
| B | `all()` over a memo with zero tags | **Require non-empty**: an untagged memo does NOT match an `all()` filter. (Diverges from strict CEL vacuous-truth, but matches search-box intuition.) |
| C | Keep `lowerAscii()` / `upperAscii()`? | **Drop** from this spec. |

## Detailed design

### ① `startsWith()` / `endsWith()` on scalar string fields

**Surface.** Allow `field.startsWith("x")` and `field.endsWith("x")` as
top-level boolean calls for scalar string fields. Today these functions are only
recognized *inside* tag comprehensions (`parser.go` `extractPredicate`).

Applicable fields: memo `content`; attachment `filename`, `mime_type`.
`creator` is intentionally **excluded**: it is an identity field with `==`/`!=`
semantics whose column is wrapped as `'users/' || username`, so prefix/suffix
matching there would match against the `users/` prefix and surprise users.

**Schema.** Generalize the per-field text-matching capability. Today `Field` has
`SupportsContains bool`. Replace/extend with a capability that also covers
prefix/suffix matching (e.g. a `SupportsTextMatch bool`, or reuse
`SupportsContains` to gate all three LIKE-based ops). Fields that already set
`SupportsContains: true` gain prefix/suffix support.

**Parser.** In `buildCallCondition`, recognize `startsWith` / `endsWith` calls
whose target is a scalar string field and whose single argument is a string
literal. Reject non-literal arguments and fields without the capability.

**IR.** Generalize `ContainsCondition` into a single node:

```go
type TextMatchMode string
const (
    TextMatchContains TextMatchMode = "contains"
    TextMatchPrefix   TextMatchMode = "prefix"
    TextMatchSuffix   TextMatchMode = "suffix"
)

type TextMatchCondition struct {
    Field string
    Mode  TextMatchMode
    Value string
}
```

`contains()` migrates to `TextMatchCondition{Mode: TextMatchContains}`.

**Render.** Build a `LIKE` pattern from the (escaped) literal:

- prefix → `value%`
- suffix → `%value`
- contains → `%value%`

Reuse the existing case-insensitive rendering already used by `contains()`:
SQLite `memos_unicode_lower(col) LIKE memos_unicode_lower(?)`, Postgres
`col ILIKE $n`, MySQL `col LIKE ?`.

**LIKE-escaping fix.** The current `contains()` renderer interpolates the raw
value into the pattern without escaping `%`, `_`, or `\`. This means a search
for `50%` behaves as a wildcard. The new shared path will escape these
metacharacters (and emit `ESCAPE '\'` where required by the dialect). This
closes a small latent wildcard-injection inconsistency and applies uniformly to
contains/prefix/suffix.

### ② `all()` comprehension on tag lists

**Surface.** Allow `tags.all(t, <pred>)` where `<pred>` is one of the predicates
already supported for `exists()`: `t == "x"`, `t.startsWith("x")`,
`t.endsWith("x")`, `t.contains("x")`.

**Parser.** `detectComprehensionKind` currently accepts only `exists()` and
explicitly rejects `all()`. Add a `ComprehensionAll` kind (accumulator inits to
`true`, loop step uses `_&&_`). Reuse the existing predicate extraction.

**IR.** Add `ComprehensionAll` to the `ComprehensionKind` enum; the existing
`ListComprehensionCondition` already carries `Kind`.

**Render — proper per-element semantics.** The existing `exists()`
implementation matches the *serialized* JSON array text with `LIKE`, which works
for "at least one element matches a substring" but **cannot** express "every
element matches." `all()` therefore needs real per-element iteration. Decision B
(require non-empty) means: array is non-empty **AND** no element fails the
predicate.

- **SQLite:**
  ```sql
  (<array> IS NOT NULL AND <array> != '[]'
   AND NOT EXISTS (SELECT 1 FROM json_each(<array>)
                   WHERE NOT (<predicate on json_each.value>)))
  ```
- **Postgres:**
  ```sql
  (<array> IS NOT NULL AND jsonb_array_length(<array>) > 0
   AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(<array>) AS e(value)
                   WHERE NOT (<predicate on e.value>)))
  ```
- **MySQL:**
  ```sql
  (<array> IS NOT NULL AND JSON_LENGTH(<array>) > 0
   AND NOT EXISTS (SELECT 1 FROM JSON_TABLE(<array>, '$[*]'
                     COLUMNS (value VARCHAR(512) PATH '$')) AS j
                   WHERE NOT (<predicate on j.value>)))
  ```

The per-element predicate reuses LIKE/`=` against the element `value`
(case-insensitive for `startsWith`/`endsWith`/`contains`, consistent with ①).
Hierarchical-tag prefix behavior should match the existing `exists()` rendering
(a prefix matches the exact tag or a `tag/...` child).

> Note: this introduces correlated subqueries against the same `memo.payload`
> column the outer query already reads; confirm the generated SQL composes with
> the surrounding `WHERE` and placeholder offsets in `helpers.AppendConditions`.

### ④ `matches(regex)` on string fields

**Surface.** Allow `field.matches("pattern")` for the same free-text fields as ①
(`content`, `filename`, `mime_type`; `creator` excluded), literal pattern only.

**Env / validation.** Add `cel.ValidateRegexLiterals()` to the env options in
`schema.go` so malformed patterns fail at compile time with a clear message
(validated against Go's RE2).

**Parser / IR.** Recognize `matches` calls; add:

```go
type RegexCondition struct {
    Field   string
    Pattern string
}
```

Reject non-literal patterns and fields without text-match capability.

**Render.**

- **Postgres:** `col ~ $n`
- **MySQL:** `col REGEXP ?`
- **SQLite:** `col REGEXP ?`. SQLite desugars `X REGEXP Y` to the function call
  `regexp(Y, X)`, so register a 2-arg scalar function named `regexp(pattern,
  value)` returning 1/0, backed by Go's `regexp` package, following the
  `ensureUnicodeLowerRegistered` pattern in `store/db/sqlite/functions.go`.
  Compile patterns lazily with a small cache (or rely on RE2 compile per call;
  decide during implementation based on measured cost).

**Documented caveats** (engine differences are inherent, not bugs):

- Regex *syntax* differs per engine: SQLite uses Go RE2; Postgres uses POSIX
  ERE; MySQL 8.0+ uses ICU. Portable patterns work everywhere; engine-specific
  constructs may not. Document this in `internal/filter/README.md`.
- ReDoS risk is low: RE2 (SQLite path) is linear-time; Postgres/MySQL POSIX
  engines do not catastrophically backtrack. `ValidateRegexLiterals()` rejects
  patterns that don't compile under RE2 as a first-line guard.

## Testing strategy

For each feature, add golden tests in
`store/db/{sqlite,mysql,postgres}/memo_filter_test.go` (and the attachment
filter tests where applicable):

- **Happy path:** assert the exact SQL fragment and args per dialect.
- **Error paths:** non-literal argument, unsupported field, malformed regex,
  unsupported predicate inside `all()`.
- **`all()` empty-set:** confirm an untagged memo does not match (decision B).
- **LIKE escaping:** confirm `%`, `_`, `\` in `contains`/`startsWith`/`endsWith`
  values are treated literally.

Run `go test ./...` (engine unit tests plus all three dialect suites). The
`contains()` → `TextMatchCondition` refactor must keep existing golden outputs
unchanged except for the intentional escaping fix.

## Rollout / sequencing

This is the first of two specs. The second (already agreed) covers engine
hardening: tightened parser limits (`ParserExpressionSizeLimit`,
`ParserRecursionLimit`, `ParserErrorRecoveryLimit`), the
`ValidateComprehensionNestingLimit` / `ValidateHomogeneousAggregateLiterals`
validators, and migrating `parser.go` off the deprecated
`genproto/.../expr/v1alpha1` proto to the native `common/ast` API. Building this
surface-expansion spec first is acceptable; the hardening migration is a pure
refactor that the golden tests written here will help protect.
