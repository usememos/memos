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
- Persistence: the transform lives on `IdentityProviderConfig` alongside `OAuth2Config` in the existing `idp.config` JSON blob. No new DB column and no schema migration — the field is presence-tracked inside the wrapper message so empty means "no transform".
- Hard error on bad return and save-time validation remain unchanged.
- Field renamed from `identifier_transform_script` to `identifier_transform` — "script" implies multi-statement; "transform" is accurate for a single expression.

## Design Goals

1. **G1 — Configurable transform**: An admin can store an `expr` expression on an `IdentityProvider` and it is applied to `userInfo.Identifier` before the value is used as a username. Verifiable: sign-in with an email-shaped identifier succeeds when a conforming expression is configured.

2. **G2 — Strict contract enforcement**: An expression that returns a non-string, an empty string, or a value that fails `validateUsername` causes sign-in to return `InvalidArgument`. Verifiable: unit test with expression `'""'` (empty) asserts error.

3. **G3 — Save-time validation**: `CreateIdentityProvider` and `UpdateIdentityProvider` reject an invalid expression with `InvalidArgument` before persisting. Verifiable: test that `"unknownFunc(identifier)"` is rejected at create time.

4. **G4 — No timeout needed**: `expr` expressions cannot loop; no goroutine or timer is required. Verifiable: build has no `time.AfterFunc` or `vm.Interrupt` code.

5. **G5 — No schema-breaking change**: Existing `IdentityProvider` rows without a transform continue to work unchanged. The transform lives inside the existing `idp.config` JSON blob, so no DB migration is required, and the store write path keeps the legacy `OAuth2Config` JSON shape whenever the transform is empty so rolling back to a pre-feature binary still reads every row correctly. Verifiable: `store.TestConvertIdentityProviderConfigFromRaw_LegacyOAuth2Shape` and the `WritesLegacyWhenTransformEmpty` test both assert this.

6. **G6 — No CGo dependency**: `expr-lang/expr` compiles with `CGO_ENABLED=0`. Verifiable: `CGO_ENABLED=0 go build ./...` passes.

## Non-Goals

All non-goals from definition.md apply. Additionally:

- Multi-statement scripting logic (loops, conditionals beyond ternary, variable assignment).
- Exposing Go APIs (HTTP, filesystem, crypto) to the expression environment.
- Caching compiled `expr.Program` instances across requests.

## Proposed Design

### 1. New proto field

**`proto/store/idp.proto`** — add to `IdentityProviderConfig`:
```
optional string identifier_transform = 2;
```

**`proto/api/v1/idp_service.proto`** — add to `IdentityProviderConfig`:
```
optional string identifier_transform = 2 [(google.api.field_behavior) = OPTIONAL];
```

Marked `optional` so the store layer and the API can distinguish "field omitted" from "explicitly cleared" on partial update_mask patches.

Run `buf generate` to regenerate `proto/gen/store/idp.pb.go`, `proto/gen/api/v1/idp_service.pb.go`, `proto/gen/openapi.yaml`, and the TS bindings under `web/src/types/proto/`.

### 2. No schema migration

The new field is serialized inside the existing `idp.config` text column alongside `OAuth2Config`. The store layer keeps writing the historical `OAuth2Config`-only JSON shape whenever `identifier_transform` is empty, and only switches to the wrapped `IdentityProviderConfig` JSON when the transform is actually set. This makes the change safe to roll back: binaries without the feature continue to read every untouched row correctly.

### 3. Store layer

**`store/idp.go`**: `convertIdentityProviderConfigFromRaw` transparently decodes both the legacy `OAuth2Config`-only JSON and the new `IdentityProviderConfig` wrapper (disambiguated by which representation populates fields), so upgrade is transparent. `convertIdentityProviderConfigToRaw` picks the legacy or wrapper shape depending on whether `identifier_transform` is set. No changes to `store.IdentityProvider` struct shape or to any of the per-backend SQL drivers.

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
2. Reject expressions longer than `maxIdentifierTransformLength` (1024) bytes up front.
3. `env := map[string]any{"identifier": identifier}`
4. `expr.Compile(expression, expr.Env(env), expr.AsKind(reflect.String), expr.MaxNodes(maxIdentifierTransformNodes))` — the `MaxNodes` cap (64) is a defence-in-depth guard against pathological nested built-ins; expr-lang has no looping constructs, so capping AST size is an effective DoS guard.
5. `result, err := expr.Run(program, env)` — error on runtime failure.
6. Assert `result.(string)` is non-empty and at most `maxTransformOutputLength` (255) bytes.

`ValidateIdentifierTransform` uses the same compile step with `identifier = ""` so admins get save-time feedback without evaluating against real user data.

### 5. IdP service layer

**`server/router/api/v1/idp_service.go`**

- `convertIdentityProviderFromStore` / `convertIdentityProviderConfigToStore`: pass the presence-tracked `*string` through so GET → modify → PATCH round-trips preserve the field.
- `CreateIdentityProvider`: call `validateIdentityProviderConfig` after UID generation; return `InvalidArgument` on error.
- `UpdateIdentityProvider` handles two masks:
  - `"config"` — full config replacement, with a presence-aware merge for `identifier_transform` so clients that don't know about the field (or don't round-trip it) cannot silently clear it. An explicit empty string in the request clears the stored value.
  - `"config.identifier_transform"` — touches only the transform, so admins can flip it on/off without re-submitting the OAuth2 payload.
- `validateStoreIdentityProviderConfig` is the single source of truth for config validity; `validateIdentityProviderConfig` is a thin API-facing guard that only enforces the precondition needed to safely run `convertIdentityProviderConfigToStore` and then delegates.

### 6. Auth service — sign-in path

**`server/router/api/v1/auth_service.go`** — after the identifier_filter check, before `GetUser`:

```
username := userInfo.Identifier
if transform := identityProvider.Config.GetIdentifierTransform(); transform != "" {
    username, err = idp.ApplyIdentifierTransform(transform, userInfo.Identifier)
    if err != nil {
        return nil, status.Errorf(codes.InvalidArgument, "identifier transform failed: %v", err)
    }
    if err := validateUsername(username); err != nil {
        return nil, status.Errorf(codes.InvalidArgument,
            "transformed identifier %q is not a valid username: %v", username, err)
    }
}

user, err := resolveExistingSSOUser(userInfo.Identifier, username, ...)
```

`resolveExistingSSOUser` performs two lookups when the transform is active: first by the raw IdP identifier, then by the transformed username. This preserves access for accounts provisioned before the transform was configured (whose stored username is the email-shaped raw identifier) without eagerly migrating those accounts to the new shape.

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
