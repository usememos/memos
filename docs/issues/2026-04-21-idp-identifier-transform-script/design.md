## References

1. **expr-lang/expr README** — https://github.com/expr-lang/expr  
   Pure-Go expression evaluator. Compiles expressions to bytecode, type-checks at compile time, supports string built-ins (`split`, `lower`, `upper`, `trim`, `replace`, etc.). No loops possible — no timeout needed. Used by ArgoCD, Cilium, and others for policy evaluation. No CGo.

2. **expr built-in functions** — https://expr-lang.org/docs/language-definition  
   Documents available string operations: `split(str, sep)`, `lower(str)`, `upper(str)`, `trim(str)`, `replace(str, old, new)`, `indexOf(str, sub)`, `hasPrefix`, `hasSuffix`. Sufficient for all realistic IdP identifier normalization patterns.

3. **Auth0 transform approach** — https://auth0.com/docs/customize/actions/write-your-first-action  
   Auth0 surfaces transform errors immediately; silent fallback on misconfigured transforms is an anti-pattern in identity pipelines.

## Industry Baseline

`expr-lang/expr` is the established Go pattern for safe, sandboxed string transformations:

- **Single expression, not a script**: `lower(split(identifier, "@")[0])` — no function wrapper, no multi-statement logic.
- **Compile-time type safety**: `expr.Compile` with `expr.AsKind(reflect.String)` enforces string return at compile time, not runtime.
- **No loops possible**: by language design, no infinite-loop risk — no timeout or interrupt mechanism needed.
- **Save-time validation**: `expr.Compile` is cheap and can be called at `CreateIdentityProvider`/`UpdateIdentityProvider` to reject invalid expressions before persisting.
- **Binary footprint**: ~500KB vs ~5MB for a full JS engine.

## Research Summary

- `expr-lang/expr` replaces goja as the engine: same sandboxing guarantees, smaller footprint, no timeout complexity, type-safe return enforcement.
- Expression contract (single expression string) replaces the named-function contract — simpler for admins to write and validate.
- All other architectural decisions from the original design remain unchanged: top-level column on `idp` table, hard error on bad return, save-time validation, no fallback.
- Field renamed from `identifier_transform_script` to `identifier_transform` — "script" implies multi-statement; "transform" is accurate for a single expression.

## Design Goals

1. **G1 — Configurable transform**: An admin can store an `expr` expression on an `IdentityProvider` and it is applied to `userInfo.Identifier` before the value is used as a username. Verifiable: sign-in with an email-shaped identifier succeeds when a conforming expression is configured.

2. **G2 — Strict contract enforcement**: An expression that returns a non-string, an empty string, or a value that fails `validateUsername` causes sign-in to return `InvalidArgument`. Verifiable: unit test with expression `'""'` (empty) asserts error.

3. **G3 — Save-time validation**: `CreateIdentityProvider` and `UpdateIdentityProvider` reject an invalid expression with `InvalidArgument` before persisting. Verifiable: test that `"unknownFunc(identifier)"` is rejected at create time.

4. **G4 — No timeout needed**: `expr` expressions cannot loop; no goroutine or timer is required. Verifiable: build has no `time.AfterFunc` or `vm.Interrupt` code.

5. **G5 — No schema-breaking change**: Existing `IdentityProvider` rows without a transform continue to work unchanged (empty string = no transform). Verifiable: existing integration tests pass without modification.

6. **G6 — No CGo dependency**: `expr-lang/expr` compiles with `CGO_ENABLED=0`. Verifiable: `CGO_ENABLED=0 go build ./...` passes.

## Non-Goals

All non-goals from definition.md apply. Additionally:

- Multi-statement scripting logic (loops, conditionals beyond ternary, variable assignment).
- Exposing Go APIs (HTTP, filesystem, crypto) to the expression environment.
- Caching compiled `expr.Program` instances across requests.

## Proposed Design

### 1. New proto field

**`proto/store/idp.proto`** — add to `IdentityProvider`:
```
string identifier_transform = 7;
```

**`proto/api/v1/idp_service.proto`** — add to `IdentityProvider`:
```
string identifier_transform = 6 [(google.api.field_behavior) = OPTIONAL];
```

Run `buf generate` to regenerate `proto/gen/store/idp.pb.go` and `proto/gen/api/v1/idp_service.pb.go`.

### 2. Schema migration

Add `identifier_transform TEXT NOT NULL DEFAULT ''` column to the `idp` table in all three backends.

New versioned migration files (version `0.28`, one file each):
- `store/migration/sqlite/0.28/00__idp_identifier_transform.sql`
- `store/migration/postgres/0.28/00__idp_identifier_transform.sql`
- `store/migration/mysql/0.28/00__idp_identifier_transform.sql`

Each contains: `ALTER TABLE idp ADD COLUMN identifier_transform TEXT NOT NULL DEFAULT '';`

Update `LATEST.sql` for all three backends to include the new column.

### 3. Store layer

**`store/idp.go`**: add `IdentifierTransform string` to `store.IdentityProvider`, `IdentifierTransform *string` to `UpdateIdentityProvider` and `UpdateIdentityProviderV1`, update converter functions.

**`store/db/sqlite/idp.go`**, **`store/db/postgres/idp.go`**, **`store/db/mysql/idp.go`**: add `identifier_transform` to INSERT, SELECT/Scan, and UPDATE SET.

### 4. Expression executor

New file: **`internal/idp/transform.go`**

Dependency: `github.com/expr-lang/expr`

```
// ApplyIdentifierTransform evaluates expression against identifier.
// expression is an expr-lang expression that must return a non-empty string.
// Empty expression is a no-op: returns (identifier, nil).
func ApplyIdentifierTransform(expression, identifier string) (string, error)

// ValidateIdentifierTransform compiles expression to catch errors at save time.
// Returns nil if expression is empty.
func ValidateIdentifierTransform(expression string) error
```

`ApplyIdentifierTransform` internal flow:
1. If `expression == ""` return `(identifier, nil)`.
2. `env := map[string]any{"identifier": identifier}`
3. `program, err := expr.Compile(expression, expr.Env(env), expr.AsKind(reflect.String))` — error on type mismatch or syntax.
4. `result, err := expr.Run(program, env)` — error on runtime failure.
5. Assert `result.(string)` is non-empty.
6. Return result.

`ValidateIdentifierTransform` uses same compile step with `identifier = ""`.

### 5. IdP service layer

**`server/router/api/v1/idp_service.go`**

- `convertIdentityProviderFromStore`: map `storepb.IdentityProvider.IdentifierTransform` → `v1pb.IdentityProvider.IdentifierTransform`.
- `convertIdentityProviderToStore`: reverse.
- `CreateIdentityProvider`: call `idp.ValidateIdentifierTransform` after convert; return `InvalidArgument` on error.
- `UpdateIdentityProvider`: add `"identifier_transform"` case to update_mask switch; call `ValidateIdentifierTransform` before persisting.

### 6. Auth service — sign-in path

**`server/router/api/v1/auth_service.go`** — after identifier_filter check (~line 133), before `GetUser`:

```
username := userInfo.Identifier
if identityProvider.IdentifierTransform != "" {
    username, err = idp.ApplyIdentifierTransform(
        identityProvider.IdentifierTransform,
        userInfo.Identifier,
    )
    if err != nil {
        return nil, status.Errorf(codes.InvalidArgument, "identifier transform failed: %v", err)
    }
    if err := validateUsername(username); err != nil {
        return nil, status.Errorf(codes.InvalidArgument,
            "transformed identifier %q is not a valid username: %v", username, err)
    }
}
```

Replace `userInfo.Identifier` at lines 136 and 153 with `username`.

### Data flow

```
SSO sign-in
  → oauth2.UserInfo() → userInfo.Identifier ("jane@gmail.com")
  → identifier_filter check (unchanged)
  → ApplyIdentifierTransform(`lower(split(identifier, "@")[0])`, "jane@gmail.com")
      expr: → "jane"
  → validateUsername("jane") → ok
  → store.GetUser(Username: "jane") / store.CreateUser(Username: "jane")
```

### Dependency addition

```
go get github.com/expr-lang/expr
```
