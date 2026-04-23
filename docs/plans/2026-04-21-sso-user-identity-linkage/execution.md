## Execution Log

### T1: Add `user_identity` migrations + LATEST.sql updates

**Status**: Completed
**Files Changed**:
- Created: `store/migration/sqlite/0.28/00__user_identity.sql`
- Created: `store/migration/postgres/0.28/00__user_identity.sql`
- Created: `store/migration/mysql/0.28/00__user_identity.sql`
- Modified: `store/migration/sqlite/LATEST.sql`
- Modified: `store/migration/postgres/LATEST.sql`
- Modified: `store/migration/mysql/LATEST.sql`
**Validation**:
- `rg 'CREATE TABLE \`?user_identity\`?' store/migration` — PASS (hits in all 6 expected files).
- `rg 'UNIQUE \(\`?provider\`?, \`?extern_uid\`?\)' store/migration` — PASS (6 hits).
- `go build ./...` — PASS.
**Path Corrections**: None.
**Deviations**: None.

### T2: Add `store.UserIdentity` model, `Store` methods, and driver interface

**Status**: Completed
**Files Changed**:
- Created: `store/user_identity.go`
- Modified: `store/driver.go`
**Validation**:
- Interface-only build is expected to fail until T3–T5; deferred compile check to T5.
- `rg 'CreateUserIdentity|ListUserIdentities' store/driver.go store/user_identity.go` — PASS (method declarations present in both files).
**Path Corrections**: None.
**Deviations**: None.

### T3: Implement SQLite driver for `user_identity`

**Status**: Completed
**Files Changed**:
- Created: `store/db/sqlite/user_identity.go`
**Validation**:
- `go build ./store/db/sqlite/...` — PASS.
**Path Corrections**: None.
**Deviations**: None.

### T4: Implement Postgres driver for `user_identity`

**Status**: Completed
**Files Changed**:
- Created: `store/db/postgres/user_identity.go`
**Validation**:
- `go build ./store/db/postgres/...` — PASS.
**Path Corrections**: None.
**Deviations**: None.

### T5: Implement MySQL driver for `user_identity`

**Status**: Completed
**Files Changed**:
- Created: `store/db/mysql/user_identity.go`
**Validation**:
- `go build ./...` — PASS (whole repo compiles; all drivers satisfy the `Driver` interface).
**Path Corrections**: None.
**Deviations**: None.

### T6: Add store-layer tests for `user_identity`

**Status**: Completed
**Files Changed**:
- Created: `store/test/user_identity_test.go`
**Validation**:
- `DRIVER=sqlite go test ./store/test/ -run TestUserIdentity -count=1 -v` — PASS:
  - `TestUserIdentityCreateAndGet` — PASS
  - `TestUserIdentityListByUserID` — PASS
  - `TestUserIdentityUniqueConflict` — PASS
  - `TestUserIdentitySameExternUIDDifferentProviders` — PASS
**Path Corrections**: None.
**Deviations**: None.

### T7: Add SSO username derivation helper

**Status**: Completed
**Files Changed**:
- Created: `server/router/api/v1/sso_username.go`
**Validation**:
- `go build ./server/router/api/v1/...` — PASS.
- `go vet ./server/router/api/v1/...` — PASS.
**Path Corrections**: None.
**Deviations**: None.

### T8: Route SSO sign-in through `user_identity` linkage

**Status**: Completed
**Files Changed**:
- Modified: `server/router/api/v1/auth_service.go`
  - `SignIn` SSO branch now delegates user resolution to a new `resolveSSOUser` method.
  - `resolveSSOUser` does: `user_identity` lookup → hit path (load user by linked `user_id`); miss path (registration gate → `deriveSSOUsername` → create user → create linkage → race recovery on unique(provider, extern_uid)).
  - Added `isUserIdentityUniqueViolation` helper (string match on the three backends' unique-constraint error strings, matching the pattern in `memo_service.go:103–105`).
**Validation**:
- `go build ./...` — PASS.
- `go vet ./...` — PASS.
- `DRIVER=sqlite go test ./store/test/ -run TestUserIdentity -count=1` — PASS (regression check).
**Path Corrections**:
- The plan pseudocode referenced `identityProvider.UID`; the actual protobuf type `storepb.IdentityProvider` exposes the field as `Uid`. Used `identityProvider.Uid` in the implementation. No semantic deviation.
**Deviations**: None.

## Completion Declaration

**All tasks completed successfully.**
