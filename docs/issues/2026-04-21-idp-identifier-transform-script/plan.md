## Task List

**Task Index**

T1: Add expr-lang/expr dependency [S] — T2: Update proto files [S] — T3: Regenerate proto [S] — T4: Schema migrations [M] — T5: Store layer [M] — T6: Expression executor [S] — T7: IdP service layer [M] — T8: Auth service sign-in path [S]

---

### T1: Add expr-lang/expr dependency [S]

**Objective**: Add `github.com/expr-lang/expr` to go.mod/go.sum (G6 — no CGo).
**Files**: `go.mod`, `go.sum`
**Implementation**: Run `go get github.com/expr-lang/expr` in repo root.
**Validation**: `CGO_ENABLED=0 go build ./...` — exits 0

---

### T2: Update proto files [S]

**Objective**: Add `identifier_transform` field to both proto definitions.
**Files**:
- Modify: `proto/store/idp.proto`
- Modify: `proto/api/v1/idp_service.proto`
**Implementation**:
- In `proto/store/idp.proto`: add `string identifier_transform = 7;` after field 6 (`uid`) in `IdentityProvider`.
- In `proto/api/v1/idp_service.proto`: add `string identifier_transform = 6 [(google.api.field_behavior) = OPTIONAL];` after `identifier_filter` (field 4) in `IdentityProvider`.
**Validation**: `buf lint` — exits 0

---

### T3: Regenerate proto [S]

**Objective**: Regenerate Go (and TS) from updated protos so `storepb.IdentityProvider` and `v1pb.IdentityProvider` have `IdentifierTransform` fields.
**Files**: `proto/gen/store/idp.pb.go`, `proto/gen/api/v1/idp_service.pb.go` (generated)
**Implementation**: Run `buf generate` in repo root (inside `proto/` directory per buf.yaml location).
**Validation**: `grep -n "IdentifierTransform" proto/gen/store/idp.pb.go proto/gen/api/v1/idp_service.pb.go` — both files show the field

---

### T4: Schema migrations [M]

**Objective**: Add `identifier_transform` column to `idp` table across all three DB backends and update LATEST schemas (G5).
**Files**:
- Create: `store/migration/sqlite/0.28/00__idp_identifier_transform.sql`
- Create: `store/migration/postgres/0.28/00__idp_identifier_transform.sql`
- Create: `store/migration/mysql/0.28/00__idp_identifier_transform.sql`
- Modify: `store/migration/sqlite/LATEST.sql`
- Modify: `store/migration/postgres/LATEST.sql`
- Modify: `store/migration/mysql/LATEST.sql`
**Implementation**:
1. Each migration SQL: `ALTER TABLE idp ADD COLUMN identifier_transform TEXT NOT NULL DEFAULT '';` (MySQL uses backtick quoting).
2. In each LATEST.sql, in the `idp` CREATE TABLE block, add `identifier_transform TEXT NOT NULL DEFAULT ''` after the `identifier_filter` line.
**Boundaries**: Do not modify any other table or migration file.
**Dependencies**: None
**Expected Outcome**: Six files created/modified; `go build ./store/...` passes (migrationFS embeds them).
**Validation**: `go build ./store/...` — exits 0

---

### T5: Store layer [M]

**Objective**: Thread `IdentifierTransform` through all store structs and DB driver implementations.
**Files**:
- Modify: `store/idp.go`
- Modify: `store/db/sqlite/idp.go`
- Modify: `store/db/postgres/idp.go`
- Modify: `store/db/mysql/idp.go`
**Implementation**:
1. `store/idp.go`:
   - Add `IdentifierTransform string` to `store.IdentityProvider` after `IdentifierFilter`.
   - Add `IdentifierTransform *string` to `UpdateIdentityProvider` after `IdentifierFilter *string`.
   - Add `IdentifierTransform *string` to `UpdateIdentityProviderV1` after `IdentifierFilter *string`.
   - In `convertIdentityProviderFromRaw`: set `IdentifierTransform: raw.IdentifierTransform`.
   - In `convertIdentityProviderToRaw`: set `IdentifierTransform: identityProvider.IdentifierTransform`.
   - In `UpdateIdentityProvider`: add pointer-nil-check for `IdentifierTransform` same as `IdentifierFilter`, passing to `updateRaw`.
2. `store/db/sqlite/idp.go`:
   - `CreateIdentityProvider`: add `` "`identifier_transform`" `` to fields and `create.IdentifierTransform` to args.
   - `ListIdentityProviders`: add `identifier_transform` to SELECT, scan into `identityProvider.IdentifierTransform`.
   - `UpdateIdentityProvider`: add SET clause `identifier_transform = ?` when pointer non-nil.
3. `store/db/postgres/idp.go`: same pattern with `$N` placeholders.
4. `store/db/mysql/idp.go`: same pattern with backtick quoting.
**Boundaries**: Do not touch any table other than `idp`. Do not change query logic for other fields.
**Dependencies**: T4 (schema), T3 (generated proto for storepb field)
**Expected Outcome**: All four files compile; `IdentifierTransform` flows from DB → store.IdentityProvider → storepb.IdentityProvider.
**Validation**: `go build ./store/...` — exits 0

---

### T6: Expression executor [S]

**Objective**: Implement `ApplyIdentifierTransform` and `ValidateIdentifierTransform` using `expr-lang/expr` (G1, G2, G3, G4).
**Files**:
- Create: `internal/idp/transform.go`
- Create: `internal/idp/transform_test.go`
**Implementation**:
- `transform.go`: package `idp`, import `reflect` and `github.com/expr-lang/expr`.
  - `ApplyIdentifierTransform(expression, identifier string) (string, error)`: early-return on empty, compile with `expr.Env` + `expr.AsKind(reflect.String)`, run, assert non-empty string.
  - `ValidateIdentifierTransform(expression string) error`: compile-only with `identifier = ""`, return error or nil.
- `transform_test.go`: package `idp`, table-driven tests covering:
  - empty expression → returns identifier unchanged
  - `lower(split(identifier, "@")[0])` with `"jane@gmail.com"` → `"jane"`
  - expression returning empty string → error
  - invalid expression → `ValidateIdentifierTransform` returns error
**Validation**: `go test ./internal/idp/...` — PASS

---

### T7: IdP service layer [M]

**Objective**: Wire `IdentifierTransform` through the IdP CRUD service: converters, save-time validation, and update_mask handling (G1, G3).
**Files**:
- Modify: `server/router/api/v1/idp_service.go`
**Implementation**:
1. Add import `"github.com/usememos/memos/internal/idp"` (already imported as package alias `idp` — check first; if not, add).
2. `convertIdentityProviderFromStore` (~line 140): add `IdentifierTransform: identityProvider.IdentifierTransform`.
3. `convertIdentityProviderToStore` (~line 168): add `IdentifierTransform: identityProvider.IdentifierTransform`.
4. `CreateIdentityProvider` (~line 20): after `storeIdp := convertIdentityProviderToStore(...)`, call `idp.ValidateIdentifierTransform(storeIdp.IdentifierTransform)`; return `codes.InvalidArgument` on error.
5. `UpdateIdentityProvider` update_mask switch (~line 110): add `case "identifier_transform": update.IdentifierTransform = &request.IdentityProvider.IdentifierTransform`. After the switch, call `ValidateIdentifierTransform` if `update.IdentifierTransform != nil`.
**Boundaries**: Do not change auth logic, ACL, or any other service method.
**Dependencies**: T3, T5
**Expected Outcome**: IdP create/update persists and returns `identifier_transform`; invalid expression rejected at save time.
**Validation**: `go build ./server/...` — exits 0

---

### T8: Auth service sign-in path [S]

**Objective**: Apply the stored transform expression at sign-in time before username lookup/create (G1, G2).
**Files**: `server/router/api/v1/auth_service.go`
**Implementation**:
- After identifier_filter check (~line 133), before `store.GetUser` (~line 135):
  - Declare `username := userInfo.Identifier`.
  - If `identityProvider.IdentifierTransform != ""`: call `idp.ApplyIdentifierTransform`; on error return `codes.InvalidArgument`; then call `validateUsername(username)`; on error return `codes.InvalidArgument`.
- Replace `userInfo.Identifier` at ~line 136 (`Username: &userInfo.Identifier`) with `&username`.
- Replace `userInfo.Identifier` at ~line 153 (`Username: userInfo.Identifier`) with `username`.
- `internal/idp` is already imported as `"github.com/usememos/memos/internal/idp"` — no new import needed.
**Validation**: `go build ./server/...` — exits 0

## Out-of-Scope Tasks

- UI editor for the transform expression.
- Migration of existing email-shaped username rows.
- Any change to `identifier_filter` logic.
- Integration/e2e tests beyond unit tests of the executor.
