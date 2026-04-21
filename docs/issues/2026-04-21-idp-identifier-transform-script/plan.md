## Task List

**Task Index**

T1: Add expr-lang/expr dependency [S] — T2: Add proto field [S] — T3: Regenerate proto [S] — T4: Backward-compatible config serialization [M] — T5: Expression executor [S] — T6: IdP service layer [M] — T7: Auth service sign-in path [S] — T8: Tests [M]

---

### T1: Add expr-lang/expr dependency [S]

**Objective**: Add `github.com/expr-lang/expr` as a direct dependency (G6 — no CGo).
**Files**: `go.mod`, `go.sum`
**Implementation**: `go get github.com/expr-lang/expr@v1.17.8` in repo root.
**Validation**: `CGO_ENABLED=0 go build ./...` — exits 0; the entry appears in the direct `require` block, not `// indirect`.

---

### T2: Add proto field [S]

**Objective**: Add `identifier_transform` to both proto `IdentityProviderConfig` messages as a presence-tracked optional string. No new top-level `IdentityProvider` field, no DB column.
**Files**:
- Modify: `proto/store/idp.proto`
- Modify: `proto/api/v1/idp_service.proto`
**Implementation**:
- In `proto/store/idp.proto`, inside `IdentityProviderConfig` after the `oneof config { ... }` block: `optional string identifier_transform = 2;`
- In `proto/api/v1/idp_service.proto`, same location: `optional string identifier_transform = 2 [(google.api.field_behavior) = OPTIONAL];`
**Validation**: `buf lint` exits 0.

---

### T3: Regenerate proto [S]

**Objective**: Regenerate Go/TS/OpenAPI bindings so `IdentifierTransform *string` is available on both `storepb.IdentityProviderConfig` and `v1pb.IdentityProviderConfig`.
**Files**: `proto/gen/store/idp.pb.go`, `proto/gen/api/v1/idp_service.pb.go`, `proto/gen/openapi.yaml`, `web/src/types/proto/api/v1/idp_service_pb.ts` (all generated).
**Implementation**: `cd proto && buf generate`.
**Validation**: `rg IdentifierTransform proto/gen/store/idp.pb.go proto/gen/api/v1/idp_service.pb.go` — both files show `*string` field with `proto3,oneof`.

---

### T4: Backward-compatible config serialization [M]

**Objective**: Persist `identifier_transform` inside the existing `idp.config` text column without a schema migration (G5), and make the read/write path downgrade-safe so a rollback to a binary that predates this feature continues to read every row.
**Files**:
- Modify: `store/idp.go`
- Create: `store/idp_test.go`
**Implementation**:
1. `convertIdentityProviderConfigToRaw`: when `identifier_transform` is empty, keep marshaling the legacy `OAuth2Config` JSON (as pre-feature binaries produced). When set, marshal the full `IdentityProviderConfig` wrapper.
2. `convertIdentityProviderConfigFromRaw`: try the wrapper format first; fall back to the legacy `OAuth2Config` JSON when the wrapper unmarshal yields no `oauth2_config` and no `identifier_transform`. `protojsonUnmarshaler.DiscardUnknown=true` makes both unmarshals tolerant.
3. Unit tests in `store/idp_test.go`: legacy read, new-wrapper read, legacy-write-on-empty, wrapper-write-on-set, and a full legacy→wrapper round-trip.
**Boundaries**: No changes to DB driver files, no migration files. Touch only config serialization.
**Dependencies**: T3.
**Validation**: `go test ./store/...` passes.

---

### T5: Expression executor [S]

**Objective**: Implement `ApplyIdentifierTransform` and `ValidateIdentifierTransform` using `expr-lang/expr` with defence-in-depth resource caps (G1, G2, G3, G4).
**Files**:
- Create: `internal/idp/transform.go`
- Create: `internal/idp/transform_test.go`
**Implementation**:
- Package-level constants: `maxIdentifierTransformLength=1024` (expression length cap), `maxTransformOutputLength=255` (output length cap), `maxIdentifierTransformNodes=64` (AST node cap).
- `ApplyIdentifierTransform(expression, identifier string) (string, error)`:
  1. Empty expression → return identifier unchanged.
  2. Reject over-long expression.
  3. `expr.Compile(expression, expr.Env(env), expr.AsKind(reflect.String), expr.MaxNodes(64))`.
  4. `expr.Run`, assert result is a non-empty string ≤ 255 bytes.
- `ValidateIdentifierTransform(expression string) error`: compile-only variant with identical caps, invoked at save time.
- `internal/idp/transform_test.go`: table-driven coverage plus explicit tests for oversize expression, oversize output, and AST-cap rejection.
**Validation**: `go test ./internal/idp/...` — PASS.

---

### T6: IdP service layer [M]

**Objective**: Wire the transform through the IdP CRUD service with presence-aware update semantics.
**Files**: `server/router/api/v1/idp_service.go`, `server/router/api/v1/test/idp_service_test.go`.
**Implementation**:
1. `convertIdentityProviderFromStore` / `convertIdentityProviderConfigToStore`: propagate the `*string` IdentifierTransform through `cloneStringPtr` so presence survives round-trip.
2. `validateIdentityProviderConfig` (API): precondition guard that ensures `oauth2_config` is non-nil for OAUTH2 then delegates to `validateStoreIdentityProviderConfig`. Avoids duplicating checks.
3. `validateStoreIdentityProviderConfig` (store): single source of truth — validates type, presence of `oauth2_config`, and compiles the transform via `idp.ValidateIdentifierTransform`.
4. `CreateIdentityProvider`: validate before converting; reject with `InvalidArgument` on failure.
5. `UpdateIdentityProvider`:
   - `mask=["config"]`: replace the config; if the request omits `identifier_transform` (nil pointer) preserve the stored value, else (pointer non-nil, including empty) apply it.
   - `mask=["config.identifier_transform"]`: touch only the transform.
   - Final safety net: `validateStoreIdentityProviderConfig` after the merge.
6. Tests: preservation under partial `config` update, explicit clearing with empty string, unsupported-type rejection, and the existing happy paths.
**Boundaries**: No changes to auth logic, ACL, or other service methods.
**Dependencies**: T3, T4, T5.
**Validation**: `go test ./server/router/api/v1/test/...` — PASS.

---

### T7: Auth service sign-in path [S]

**Objective**: Apply the stored transform at sign-in time between the identifier filter and username lookup (G1, G2).
**Files**: `server/router/api/v1/auth_service.go`, `server/router/api/v1/auth_service_sso_test.go`.
**Implementation**:
1. After the identifier_filter regex check, read the transform via `identityProvider.Config.GetIdentifierTransform()`. If non-empty, call `idp.ApplyIdentifierTransform` and then `validateUsername` on the result.
2. Replace the direct `GetUser(Username: &userInfo.Identifier)` lookup with `resolveExistingSSOUser(rawIdentifier, transformedUsername, findUser)`:
   - When a transform is active, look up the raw identifier first so accounts created before the feature was enabled continue to sign in.
   - Fall back to the transformed username for new users.
   - When no transform is configured, the transformed username equals the raw identifier and only one lookup runs.
3. `CreateUser` is always called with the transformed `username`.
4. Unit tests for `resolveExistingSSOUser` covering all three branches (raw preferred, transformed fallback, single lookup).
**Validation**: `go test ./server/router/api/v1/...` — PASS.

---

### T8: Tests [M]

Covered incrementally in T4, T5, T6, T7. No separate task — this list item is a reminder that each layer lands with its own assertions so no single catch-all test file grows out of control.

## Out-of-Scope Tasks

- UI editor for the transform expression.
- Auto-migration of existing email-shaped username rows; the raw-identifier fallback lookup in T7 preserves access but does not rename accounts.
- Any change to `identifier_filter` logic.
- Integration / e2e tests that drive a real OAuth2 provider.
- Forward/backward compatibility guarantees beyond the rollback-safety of the config serialization format (T4).
