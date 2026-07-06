# CEL Filter Surface Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users write three more CEL constructs in the `filter` field — scalar `startsWith()`/`endsWith()` (case-insensitive), `matches(regex)`, and `all()` over tags (non-empty) — each compiled to SQL across SQLite/MySQL/Postgres.

**Architecture:** The `internal/filter` engine parses CEL with `cel-go`, walks the AST into a dialect-agnostic IR (`ir.go`), and renders dialect SQL (`render.go`). cel-go never evaluates — every feature must become a SQL `WHERE` fragment. We add IR nodes + parser recognition + per-dialect rendering, and register a Go-backed `REGEXP` function for SQLite (which has no built-in one).

**Tech Stack:** Go, `github.com/google/cel-go v0.28.0`, `modernc.org/sqlite` (pure-Go), `github.com/stretchr/testify/require`.

**Spec:** `docs/superpowers/specs/2026-06-15-cel-filter-surface-expansion-design.md`

---

## File structure

| File | Change | Responsibility |
|------|--------|----------------|
| `internal/filter/ir.go` | Modify | Replace `ContainsCondition` with `TextMatchCondition`; add `RegexCondition`; add `ComprehensionAll` kind |
| `internal/filter/parser.go` | Modify | Recognize top-level `contains`/`startsWith`/`endsWith`/`matches`; accept `all()` comprehension |
| `internal/filter/render.go` | Modify | Render text-match (LIKE), regex, and `all()` per-element subqueries; shared `foldedLike`/`likePattern`/`escapeLikeLiteral` helpers |
| `internal/filter/schema.go` | Modify | Add `cel.ValidateRegexLiterals()` validator; enable text matching on attachment `mime_type` |
| `internal/filter/engine_test.go` | Modify | Compile-level accept/reject unit tests |
| `store/db/sqlite/functions.go` | Modify | Register a Go-backed `regexp(pattern, value)` scalar function with a compiled-pattern cache |
| `store/db/sqlite/sqlite.go` | Modify | Call `ensureRegexpRegistered()` in `NewDB` |
| `store/test/memo_filter_test.go` | Modify | Behavioral tests for the new memo filters |
| `store/test/attachment_filter_test.go` | Modify | Behavioral tests for `filename`/`mime_type` |
| `internal/filter/README.md` | Modify | Document new syntax + regex cross-dialect caveat |

**Key design choices locked in:**
- The existing `Field.SupportsContains` flag is **reused** as the gate for *all* text-matching ops (`contains`/`startsWith`/`endsWith`/`matches`) — no rename, lower risk. We just enable it on `mime_type`.
- New scalar `startsWith`/`endsWith`/`contains` are **case-insensitive** (reuse the existing `memos_unicode_lower` / `ILIKE` machinery). `matches()` and `==` are case-sensitive.
- `all()` over a memo with zero tags does **not** match (non-empty guard).
- LIKE patterns escape `%` `_` `\`; only SQLite needs an explicit `ESCAPE '\'` clause (Postgres/MySQL default the escape char to backslash, and patterns are passed as bound parameters so no SQL-literal backslash hazard).

**Suggested task order** lands the two cheap features (text-match refactor, scalar prefix/suffix, regex) before the heavy `all()` work, giving a natural stop point. `all()` (Task 5) is the largest piece and could be deferred to a follow-up if needed.

---

### Task 1: Refactor `ContainsCondition` → `TextMatchCondition` (+ LIKE escaping)

Foundation refactor. No new user-facing behavior except that LIKE metacharacters in `contains()` values are now treated literally. Existing tests must stay green.

**Files:**
- Modify: `internal/filter/ir.go` (replace `ContainsCondition`)
- Modify: `internal/filter/parser.go` (`buildContainsCondition` → shared builder)
- Modify: `internal/filter/render.go` (`renderContainsCondition` → `renderTextMatch` + helpers)

- [ ] **Step 1: Add a failing escaping test** in `internal/filter/engine_test.go`

```go
func TestCompileContainsEscapesLikeWildcards(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	stmt, err := engine.CompileToStatement(context.Background(), `content.contains("50%_off")`, RenderOptions{Dialect: DialectSQLite})
	require.NoError(t, err)
	// The % and _ in the value must be escaped so they are matched literally,
	// and SQLite needs an explicit ESCAPE clause.
	require.Contains(t, stmt.SQL, `ESCAPE '\'`)
	require.Equal(t, []any{`%50\%\_off%`}, stmt.Args)
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `go test ./internal/filter/ -run TestCompileContainsEscapesLikeWildcards -v`
Expected: FAIL (current renderer emits `%50%_off%` with no `ESCAPE`).

- [ ] **Step 3: Replace `ContainsCondition` in `internal/filter/ir.go`**

Delete the `ContainsCondition` struct + its `isCondition()` (lines ~76-82) and add:

```go
// TextMatchMode enumerates LIKE-based string match modes.
type TextMatchMode string

const (
	TextMatchContains TextMatchMode = "contains"
	TextMatchPrefix   TextMatchMode = "prefix"
	TextMatchSuffix   TextMatchMode = "suffix"
)

// TextMatchCondition models a case-insensitive LIKE match on a scalar string field
// (content.contains/startsWith/endsWith).
type TextMatchCondition struct {
	Field string
	Mode  TextMatchMode
	Value string
}

func (*TextMatchCondition) isCondition() {}
```

- [ ] **Step 4: Update the parser in `internal/filter/parser.go`**

In `buildCallCondition`, replace the `case "contains":` line with:

```go
	case "contains":
		return buildTextMatchCondition(call, schema, TextMatchContains)
```

Delete `buildContainsCondition` (lines ~196-227) and add:

```go
func buildTextMatchCondition(call *exprv1.Expr_Call, schema Schema, mode TextMatchMode) (Condition, error) {
	if call.Target == nil {
		return nil, errors.New("text match requires a target")
	}
	targetName, err := getIdentName(call.Target)
	if err != nil {
		return nil, err
	}
	field, ok := schema.Field(targetName)
	if !ok {
		return nil, errors.Errorf("unknown identifier %q", targetName)
	}
	if !field.SupportsContains {
		return nil, errors.Errorf("identifier %q does not support text matching", targetName)
	}
	if len(call.Args) != 1 {
		return nil, errors.New("text match expects exactly one argument")
	}
	value, err := getConstValue(call.Args[0])
	if err != nil {
		return nil, errors.Wrap(err, "text match only supports literal arguments")
	}
	str, ok := value.(string)
	if !ok {
		return nil, errors.New("text match argument must be a string")
	}
	return &TextMatchCondition{Field: targetName, Mode: mode, Value: str}, nil
}
```

- [ ] **Step 5: Update the renderer in `internal/filter/render.go`**

In `renderCondition`, replace `case *ContainsCondition:` / `return r.renderContainsCondition(c)` with:

```go
	case *TextMatchCondition:
		return r.renderTextMatch(c)
```

Delete `renderContainsCondition` (lines ~449-469) and add:

```go
func (r *renderer) renderTextMatch(cond *TextMatchCondition) (renderResult, error) {
	field, ok := r.schema.Field(cond.Field)
	if !ok {
		return renderResult{}, errors.Errorf("unknown field %q", cond.Field)
	}
	column := field.columnExpr(r.dialect)
	pattern := likePattern(cond.Mode, cond.Value)
	return renderResult{sql: r.foldedLike(column, pattern)}, nil
}

// foldedLike renders a case-insensitive LIKE comparison of colExpr against a
// (already metacharacter-escaped) pattern, using each dialect's case-folding.
func (r *renderer) foldedLike(colExpr, pattern string) string {
	switch r.dialect {
	case DialectSQLite:
		// memos_unicode_lower gives Unicode-aware folding; ESCAPE '\' is required
		// because SQLite has no default LIKE escape character.
		return fmt.Sprintf(`memos_unicode_lower(%s) LIKE memos_unicode_lower(%s) ESCAPE '\'`, colExpr, r.addArg(pattern))
	case DialectPostgres:
		// ILIKE is case-insensitive; backslash is the default escape character.
		return fmt.Sprintf("%s ILIKE %s", colExpr, r.addArg(pattern))
	default: // MySQL: default collation is case-insensitive; backslash is the default escape.
		return fmt.Sprintf("%s LIKE %s", colExpr, r.addArg(pattern))
	}
}

// likePattern escapes LIKE metacharacters in value and wraps it for the mode.
func likePattern(mode TextMatchMode, value string) string {
	escaped := escapeLikeLiteral(value)
	switch mode {
	case TextMatchPrefix:
		return escaped + "%"
	case TextMatchSuffix:
		return "%" + escaped
	default:
		return "%" + escaped + "%"
	}
}

// escapeLikeLiteral escapes the LIKE metacharacters \, %, and _ so user input
// is matched literally. Backslash is the escape character on all three dialects.
func escapeLikeLiteral(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}
```

- [ ] **Step 6: Run the new test + existing suites to verify green**

Run: `go test ./internal/filter/ -v`
Expected: PASS (including `TestCompileContainsEscapesLikeWildcards`).

Run: `go test ./store/test/ -run TestMemoFilterContent -v`
Expected: PASS (existing `contains` behavioral tests, including special-characters/unicode, still pass).

- [ ] **Step 7: Commit**

```bash
git add internal/filter/ir.go internal/filter/parser.go internal/filter/render.go internal/filter/engine_test.go
git commit -m "refactor(filter): unify string matching into TextMatchCondition with LIKE escaping

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Scalar `startsWith()` / `endsWith()`

Wire the new prefix/suffix modes through the parser and enable text matching on attachment `mime_type`. Rendering already exists from Task 1.

**Files:**
- Modify: `internal/filter/parser.go` (add `startsWith`/`endsWith` cases)
- Modify: `internal/filter/schema.go` (enable `SupportsContains` on `mime_type`)
- Modify: `store/test/memo_filter_test.go`, `store/test/attachment_filter_test.go` (behavioral tests)
- Modify: `internal/filter/engine_test.go` (reject on unsupported field)

- [ ] **Step 1: Add failing behavioral tests** in `store/test/memo_filter_test.go`

```go
func TestMemoFilterContentStartsWith(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-todo", tc.User.ID).Content("TODO: buy milk"))
	tc.CreateMemo(NewMemoBuilder("memo-done", tc.User.ID).Content("Done with milk"))

	// Prefix match, case-insensitive (consistent with contains()).
	memos := tc.ListWithFilter(`content.startsWith("todo")`)
	require.Len(t, memos, 1)
	require.Equal(t, "memo-todo", memos[0].UID)

	memos = tc.ListWithFilter(`content.startsWith("nope")`)
	require.Len(t, memos, 0)
}

func TestMemoFilterContentEndsWith(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-md", tc.User.ID).Content("notes.md"))
	tc.CreateMemo(NewMemoBuilder("memo-txt", tc.User.ID).Content("notes.txt"))

	memos := tc.ListWithFilter(`content.endsWith(".md")`)
	require.Len(t, memos, 1)
	require.Equal(t, "memo-md", memos[0].UID)
}
```

And in `store/test/attachment_filter_test.go`:

```go
func TestAttachmentFilterFilenameStartsWith(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContextWithUser(t)
	defer tc.Close()

	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("invoice-2026.pdf").MimeType("application/pdf"))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("photo.png").MimeType("image/png"))

	got := tc.ListWithFilter(`filename.startsWith("invoice")`)
	require.Len(t, got, 1)
	require.Equal(t, "invoice-2026.pdf", got[0].Filename)

	// mime_type prefix matching (newly enabled).
	got = tc.ListWithFilter(`mime_type.startsWith("image/")`)
	require.Len(t, got, 1)
	require.Equal(t, "photo.png", got[0].Filename)
}
```

- [ ] **Step 2: Run to verify they fail**

Run: `go test ./store/test/ -run 'TestMemoFilterContentStartsWith|TestMemoFilterContentEndsWith|TestAttachmentFilterFilenameStartsWith' -v`
Expected: FAIL — `startsWith` hits `buildCallCondition`'s default branch ("unsupported call expression"), and `mime_type` is not yet text-matchable.

- [ ] **Step 3: Add parser cases** in `internal/filter/parser.go` `buildCallCondition`

Immediately after the `case "contains":` line, add:

```go
	case "startsWith":
		return buildTextMatchCondition(call, schema, TextMatchPrefix)
	case "endsWith":
		return buildTextMatchCondition(call, schema, TextMatchSuffix)
```

- [ ] **Step 4: Enable text matching on `mime_type`** in `internal/filter/schema.go`

In `NewAttachmentSchema`, add `SupportsContains: true` to the `mime_type` field entry:

```go
		"mime_type": {
			Name:             "mime_type",
			Kind:             FieldKindScalar,
			Type:             FieldTypeString,
			Column:           Column{Table: "attachment", Name: "type"},
			SupportsContains: true,
			Expressions:      map[DialectName]string{},
		},
```

- [ ] **Step 5: Add a compile-reject unit test** in `internal/filter/engine_test.go`

```go
func TestCompileRejectsStartsWithOnUnsupportedField(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	_, err = engine.Compile(context.Background(), `visibility.startsWith("P")`)
	require.Error(t, err)
	require.Contains(t, err.Error(), "does not support text matching")
}
```

- [ ] **Step 6: Run tests to verify green**

Run: `go test ./internal/filter/ ./store/test/ -run 'StartsWith|EndsWith|TextMatch' -v`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add internal/filter/parser.go internal/filter/schema.go internal/filter/engine_test.go store/test/memo_filter_test.go store/test/attachment_filter_test.go
git commit -m "feat(filter): support startsWith()/endsWith() on scalar string fields

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Register a SQLite `REGEXP` function

`modernc.org/sqlite` has no built-in `REGEXP`. SQLite desugars `X REGEXP Y` to `regexp(Y, X)`, so register a 2-arg `regexp(pattern, value)` scalar function backed by Go's `regexp`, mirroring `ensureUnicodeLowerRegistered`.

**Files:**
- Modify: `store/db/sqlite/functions.go`
- Modify: `store/db/sqlite/sqlite.go`
- Test: `store/db/sqlite/functions_test.go` (create)

- [ ] **Step 1: Write a failing test** — create `store/db/sqlite/functions_test.go`

```go
package sqlite

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRegexpFunctionMatches(t *testing.T) {
	require.NoError(t, ensureRegexpRegistered())

	re, err := compileRegexp(`^v\d+$`)
	require.NoError(t, err)
	require.True(t, re.MatchString("v12"))
	require.False(t, re.MatchString("version"))

	// Caching returns the same compiled instance.
	re2, err := compileRegexp(`^v\d+$`)
	require.NoError(t, err)
	require.Same(t, re, re2)

	_, err = compileRegexp(`(`)
	require.Error(t, err)
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `go test ./store/db/sqlite/ -run TestRegexpFunctionMatches -v`
Expected: FAIL — `ensureRegexpRegistered`/`compileRegexp` undefined.

- [ ] **Step 3: Implement in `store/db/sqlite/functions.go`**

Add `"errors"` and `"regexp"` to the imports, then append:

```go
var (
	registerRegexpOnce sync.Once
	registerRegexpErr  error
	// regexpCache memoizes compiled patterns; keys are pattern strings.
	regexpCache sync.Map
)

// ensureRegexpRegistered registers a Go-backed `regexp(pattern, value)` scalar
// function so SQLite's `value REGEXP pattern` operator works (modernc.org/sqlite
// has no built-in implementation). Patterns use Go's RE2 syntax. Registered once
// globally; safe to call multiple times.
func ensureRegexpRegistered() error {
	registerRegexpOnce.Do(func() {
		registerRegexpErr = msqlite.RegisterScalarFunction("regexp", 2, func(_ *msqlite.FunctionContext, args []driver.Value) (driver.Value, error) {
			if len(args) != 2 || args[0] == nil || args[1] == nil {
				return int64(0), nil
			}
			pattern, ok := args[0].(string)
			if !ok {
				return nil, errors.New("regexp pattern must be a string")
			}
			var value string
			switch v := args[1].(type) {
			case string:
				value = v
			case []byte:
				value = string(v)
			default:
				return int64(0), nil
			}
			re, err := compileRegexp(pattern)
			if err != nil {
				return nil, err
			}
			if re.MatchString(value) {
				return int64(1), nil
			}
			return int64(0), nil
		})
	})
	return registerRegexpErr
}

// compileRegexp compiles and caches a RE2 pattern.
func compileRegexp(pattern string) (*regexp.Regexp, error) {
	if cached, ok := regexpCache.Load(pattern); ok {
		return cached.(*regexp.Regexp), nil
	}
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil, err
	}
	regexpCache.Store(pattern, re)
	return re, nil
}
```

- [ ] **Step 4: Wire into `NewDB`** in `store/db/sqlite/sqlite.go`

Right after the `ensureUnicodeLowerRegistered()` block, add:

```go
	if err := ensureRegexpRegistered(); err != nil {
		return nil, errors.Wrap(err, "failed to register sqlite regexp function")
	}
```

- [ ] **Step 5: Run to verify green**

Run: `go test ./store/db/sqlite/ -run TestRegexpFunctionMatches -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add store/db/sqlite/functions.go store/db/sqlite/sqlite.go store/db/sqlite/functions_test.go
git commit -m "feat(sqlite): register Go-backed REGEXP function

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `matches(regex)` on string fields

Add the IR node, parser recognition, per-dialect rendering, and the compile-time regex validator.

**Files:**
- Modify: `internal/filter/ir.go` (add `RegexCondition`)
- Modify: `internal/filter/parser.go` (`matches` case + builder)
- Modify: `internal/filter/render.go` (`renderRegex`)
- Modify: `internal/filter/schema.go` (add `cel.ValidateRegexLiterals()` to both schemas)
- Modify: `internal/filter/engine_test.go`, `store/test/memo_filter_test.go`

- [ ] **Step 1: Add failing tests** — compile-level in `internal/filter/engine_test.go`:

```go
func TestCompileRejectsMalformedRegex(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	_, err = engine.Compile(context.Background(), `content.matches("(")`)
	require.Error(t, err)
}

func TestCompileMatchesRendersRegexOperator(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	stmt, err := engine.CompileToStatement(context.Background(), `content.matches("v[0-9]+")`, RenderOptions{Dialect: DialectPostgres})
	require.NoError(t, err)
	require.Contains(t, stmt.SQL, "~")
	require.Equal(t, []any{"v[0-9]+"}, stmt.Args)
}
```

And behavioral in `store/test/memo_filter_test.go` (runs against SQLite by default, exercising the registered `REGEXP` function):

```go
func TestMemoFilterContentMatches(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-v1", tc.User.ID).Content("release v12 shipped"))
	tc.CreateMemo(NewMemoBuilder("memo-plain", tc.User.ID).Content("no version here"))

	memos := tc.ListWithFilter(`content.matches("v[0-9]+")`)
	require.Len(t, memos, 1)
	require.Equal(t, "memo-v1", memos[0].UID)

	memos = tc.ListWithFilter(`content.matches("^xyz")`)
	require.Len(t, memos, 0)
}
```

- [ ] **Step 2: Run to verify they fail**

Run: `go test ./internal/filter/ -run 'Malformed|MatchesRenders' -v && go test ./store/test/ -run TestMemoFilterContentMatches -v`
Expected: FAIL — `matches` is unhandled and no regex validator is configured.

- [ ] **Step 3: Add the IR node** in `internal/filter/ir.go`

```go
// RegexCondition models field.matches("pattern") on a string field.
type RegexCondition struct {
	Field   string
	Pattern string
}

func (*RegexCondition) isCondition() {}
```

- [ ] **Step 4: Add parser support** in `internal/filter/parser.go`

In `buildCallCondition`, after the `case "endsWith":` block, add:

```go
	case "matches":
		return buildMatchesCondition(call, schema)
```

Then add the builder:

```go
func buildMatchesCondition(call *exprv1.Expr_Call, schema Schema) (Condition, error) {
	if call.Target == nil {
		return nil, errors.New("matches requires a target")
	}
	targetName, err := getIdentName(call.Target)
	if err != nil {
		return nil, err
	}
	field, ok := schema.Field(targetName)
	if !ok {
		return nil, errors.Errorf("unknown identifier %q", targetName)
	}
	if !field.SupportsContains {
		return nil, errors.Errorf("identifier %q does not support matches()", targetName)
	}
	if len(call.Args) != 1 {
		return nil, errors.New("matches expects exactly one argument")
	}
	value, err := getConstValue(call.Args[0])
	if err != nil {
		return nil, errors.Wrap(err, "matches only supports literal arguments")
	}
	pattern, ok := value.(string)
	if !ok {
		return nil, errors.New("matches argument must be a string")
	}
	return &RegexCondition{Field: targetName, Pattern: pattern}, nil
}
```

- [ ] **Step 5: Add the renderer** in `internal/filter/render.go`

In `renderCondition`, after the `case *TextMatchCondition:` arm, add:

```go
	case *RegexCondition:
		return r.renderRegex(c)
```

Then add:

```go
func (r *renderer) renderRegex(cond *RegexCondition) (renderResult, error) {
	field, ok := r.schema.Field(cond.Field)
	if !ok {
		return renderResult{}, errors.Errorf("unknown field %q", cond.Field)
	}
	column := field.columnExpr(r.dialect)
	switch r.dialect {
	case DialectPostgres:
		// POSIX regex match operator.
		return renderResult{sql: fmt.Sprintf("%s ~ %s", column, r.addArg(cond.Pattern))}, nil
	case DialectMySQL, DialectSQLite:
		// MySQL has a native REGEXP operator; SQLite uses the registered regexp() function.
		return renderResult{sql: fmt.Sprintf("%s REGEXP %s", column, r.addArg(cond.Pattern))}, nil
	default:
		return renderResult{}, errors.Errorf("unsupported dialect %s", r.dialect)
	}
}
```

- [ ] **Step 6: Add the regex validator** in `internal/filter/schema.go`

Add the `cel` import line already present. In **both** `NewSchema` and `NewAttachmentSchema`, append the validator to the `envOptions` slice (e.g. after `nowFunction`):

```go
		cel.ASTValidators(cel.ValidateRegexLiterals()),
```

- [ ] **Step 7: Run tests to verify green**

Run: `go test ./internal/filter/ -run 'Malformed|MatchesRenders' -v && go test ./store/test/ -run TestMemoFilterContentMatches -v`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add internal/filter/ir.go internal/filter/parser.go internal/filter/render.go internal/filter/schema.go internal/filter/engine_test.go store/test/memo_filter_test.go
git commit -m "feat(filter): support matches() regex on string fields

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `all()` comprehension on tags (non-empty)

The heaviest task. `exists()` matches against the *serialized* JSON array and cannot express "every element matches", so `all()` needs real per-element iteration via `json_each` / `jsonb_array_elements_text` / `JSON_TABLE`, plus a non-empty guard.

**Files:**
- Modify: `internal/filter/ir.go` (add `ComprehensionAll`)
- Modify: `internal/filter/parser.go` (accept `all()` in `detectComprehensionKind`)
- Modify: `internal/filter/render.go` (`renderTagAll` + element predicate SQL; branch in `renderListComprehension`)
- Modify: `store/test/memo_filter_test.go`

- [ ] **Step 1: Add failing behavioral tests** in `store/test/memo_filter_test.go`

```go
func TestMemoFilterTagsAll(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-all-work", tc.User.ID).Content("all work").Tags("work/a", "work/b"))
	tc.CreateMemo(NewMemoBuilder("memo-mixed", tc.User.ID).Content("mixed").Tags("work/a", "home"))
	tc.CreateMemo(NewMemoBuilder("memo-untagged", tc.User.ID).Content("untagged"))

	// Every tag starts with "work/": only the all-work memo qualifies.
	memos := tc.ListWithFilter(`tags.all(t, t.startsWith("work/"))`)
	require.Len(t, memos, 1)
	require.Equal(t, "memo-all-work", memos[0].UID)

	// Untagged memos must NOT match (non-empty guard, decision B).
	require.NotContains(t, uids(memos), "memo-untagged")
}

func TestMemoFilterTagsAllEquals(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-only-x", tc.User.ID).Content("only x").Tags("x", "x"))
	tc.CreateMemo(NewMemoBuilder("memo-x-and-y", tc.User.ID).Content("x and y").Tags("x", "y"))

	memos := tc.ListWithFilter(`tags.all(t, t == "x")`)
	require.Len(t, memos, 1)
	require.Equal(t, "memo-only-x", memos[0].UID)
}
```

Add this helper near the top of `store/test/memo_filter_test.go` (after the imports) if not already present:

```go
func uids(memos []*store.Memo) []string {
	out := make([]string, 0, len(memos))
	for _, m := range memos {
		out = append(out, m.UID)
	}
	return out
}
```

- [ ] **Step 2: Run to verify they fail**

Run: `go test ./store/test/ -run 'TestMemoFilterTagsAll' -v`
Expected: FAIL — `detectComprehensionKind` returns "all() comprehension is not supported".

- [ ] **Step 3: Add the IR kind** in `internal/filter/ir.go`

In the `ComprehensionKind` const block, add `ComprehensionAll`:

```go
const (
	ComprehensionExists ComprehensionKind = "exists"
	ComprehensionAll    ComprehensionKind = "all"
)
```

- [ ] **Step 4: Accept `all()` in the parser** in `internal/filter/parser.go`

In `detectComprehensionKind`, replace the `all()` rejection block:

```go
	// all() starts with true and uses AND (&&) - not supported
	if accuInit.GetBoolValue() {
		if step := comp.LoopStep.GetCallExpr(); step != nil && step.Function == "_&&_" {
			return "", errors.New("all() comprehension is not supported; use exists() instead")
		}
	}
```

with:

```go
	// all() starts with true and uses AND (&&) in the loop step.
	if accuInit.GetBoolValue() {
		if step := comp.LoopStep.GetCallExpr(); step != nil && step.Function == "_&&_" {
			return ComprehensionAll, nil
		}
	}
```

- [ ] **Step 5: Branch and render in `internal/filter/render.go`**

At the top of `renderListComprehension`, right after the `field.Kind != FieldKindJSONList` guard, add:

```go
	if cond.Kind == ComprehensionAll {
		return r.renderTagAll(field, cond.Predicate)
	}
```

Then add the new render path + element-predicate helper:

```go
// renderTagAll renders tags.all(t, <pred>): the array is non-empty AND no element
// fails the predicate. Element predicates use plain CEL semantics (case-insensitive
// for startsWith/endsWith/contains, case-sensitive for ==), evaluated per element.
func (r *renderer) renderTagAll(field Field, pred PredicateExpr) (renderResult, error) {
	arrayExpr := jsonArrayExpr(r.dialect, field)
	elemCond, err := r.elementPredicateSQL(pred)
	if err != nil {
		return renderResult{}, err
	}
	switch r.dialect {
	case DialectSQLite:
		nonEmpty := fmt.Sprintf("%s IS NOT NULL AND %s != '[]'", arrayExpr, arrayExpr)
		sub := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM json_each(%s) WHERE NOT (%s))", arrayExpr, elemCond)
		return renderResult{sql: fmt.Sprintf("(%s AND %s)", nonEmpty, sub)}, nil
	case DialectMySQL:
		nonEmpty := fmt.Sprintf("%s IS NOT NULL AND JSON_LENGTH(%s) > 0", arrayExpr, arrayExpr)
		sub := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM JSON_TABLE(%s, '$[*]' COLUMNS (value VARCHAR(512) PATH '$')) AS elem WHERE NOT (%s))", arrayExpr, elemCond)
		return renderResult{sql: fmt.Sprintf("(%s AND %s)", nonEmpty, sub)}, nil
	case DialectPostgres:
		nonEmpty := fmt.Sprintf("%s IS NOT NULL AND jsonb_array_length(%s) > 0", arrayExpr, arrayExpr)
		sub := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(%s) AS elem(value) WHERE NOT (%s))", arrayExpr, elemCond)
		return renderResult{sql: fmt.Sprintf("(%s AND %s)", nonEmpty, sub)}, nil
	default:
		return renderResult{}, errors.Errorf("unsupported dialect %s", r.dialect)
	}
}

// elementPredicateSQL builds the per-element SQL condition for an all() predicate.
// The iterated element is exposed as the unqualified column `value` on all dialects
// (json_each.value / JSON_TABLE column / elem(value)).
func (r *renderer) elementPredicateSQL(pred PredicateExpr) (string, error) {
	switch p := pred.(type) {
	case *EqualsPredicate:
		return fmt.Sprintf("value = %s", r.addArg(p.Value)), nil
	case *StartsWithPredicate:
		return r.foldedLike("value", likePattern(TextMatchPrefix, p.Prefix)), nil
	case *EndsWithPredicate:
		return r.foldedLike("value", likePattern(TextMatchSuffix, p.Suffix)), nil
	case *ContainsPredicate:
		return r.foldedLike("value", likePattern(TextMatchContains, p.Substring)), nil
	default:
		return "", errors.Errorf("unsupported predicate %T in all()", pred)
	}
}
```

> Note: `foldedLike`, `likePattern`, and `escapeLikeLiteral` were added in Task 1; reuse them as-is.

- [ ] **Step 6: Run tests to verify green**

Run: `go test ./store/test/ -run 'TestMemoFilterTagsAll' -v`
Expected: PASS.

Run: `go test ./store/test/ -run 'TestMemoFilterTagsExists' -v`
Expected: PASS (exists() rendering untouched).

- [ ] **Step 7: Commit**

```bash
git add internal/filter/ir.go internal/filter/parser.go internal/filter/render.go store/test/memo_filter_test.go
git commit -m "feat(filter): support all() comprehension over tags

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Docs + full verification

**Files:**
- Modify: `internal/filter/README.md`

- [ ] **Step 1: Document the new syntax** — append to the "SQL Generation Notes" section of `internal/filter/README.md`:

```markdown
- **String Matching** — `content.contains(x)`, `content.startsWith(x)`, and
  `content.endsWith(x)` render as case-insensitive `LIKE`/`ILIKE` with LIKE
  metacharacters (`%`, `_`, `\`) escaped. Available on scalar string fields whose
  schema sets `SupportsContains` (memo `content`; attachment `filename`,
  `mime_type`).
- **Regex** — `field.matches("pattern")` renders to `~` (Postgres) or `REGEXP`
  (MySQL/SQLite). SQLite uses a Go-backed `regexp` function registered in
  `store/db/sqlite/functions.go`. Patterns are validated at compile time against
  Go's RE2 via `cel.ValidateRegexLiterals()`. **Caveat:** regex *syntax* differs
  per engine (Go RE2 on SQLite, POSIX ERE on Postgres, ICU on MySQL 8.0+), so
  engine-specific patterns may not be portable.
- **Tag `all()`** — `tags.all(t, <pred>)` matches only non-empty tag sets where
  every element satisfies the predicate, via per-element iteration
  (`json_each` / `jsonb_array_elements_text` / `JSON_TABLE`).
```

- [ ] **Step 2: Run the full engine + store suite (SQLite)**

Run: `go test ./internal/filter/... ./store/...`
Expected: PASS.

- [ ] **Step 3: Vet and lint**

Run: `go vet ./internal/filter/... ./store/db/sqlite/...`
Expected: no output.

Run: `golangci-lint run internal/filter/... store/db/sqlite/...` (if available; skip if the binary is absent).
Expected: no findings.

- [ ] **Step 4: Cross-dialect verification (if Docker/CI DSNs available)**

Run MySQL and Postgres suites to confirm the `all()` subqueries and regex operators render correctly:

```bash
DRIVER=mysql    go test ./store/test/ -run 'TagsAll|Matches|StartsWith|EndsWith'
DRIVER=postgres go test ./store/test/ -run 'TagsAll|Matches|StartsWith|EndsWith'
```

Expected: PASS. (These require the project's standard test DB setup; if unavailable locally, rely on CI which runs all three drivers.)

- [ ] **Step 5: Commit**

```bash
git add internal/filter/README.md
git commit -m "docs(filter): document string matching, regex, and tag all() support

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:** ① scalar `startsWith`/`endsWith` → Task 2; ② `all()` non-empty → Task 5; ④ `matches()` + SQLite REGEXP fn + `ValidateRegexLiterals` → Tasks 3-4; the LIKE-escaping fix → Task 1; docs/caveat → Task 6. `lowerAscii`/`upperAscii` correctly omitted (dropped in spec). Hardening/native-AST migration correctly deferred to the follow-up spec.
- **Type consistency:** `TextMatchCondition`/`TextMatchMode`/`likePattern`/`foldedLike`/`escapeLikeLiteral` (Task 1) are reused by Tasks 2 and 5; `RegexCondition`/`renderRegex` (Task 4) and `ensureRegexpRegistered`/`compileRegexp` (Task 3) names match across their call sites; `ComprehensionAll` (Task 5) matches its parser and render references.
- **Element reference:** the unqualified `value` column is produced by `json_each` (SQLite), the `JSON_TABLE(... COLUMNS (value ...))` (MySQL), and `elem(value)` (Postgres), so `elementPredicateSQL` is dialect-agnostic.
```
