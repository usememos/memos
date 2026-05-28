## Task List

**Task Index**

> T1: Add `user_identity` migrations + LATEST.sql updates for all three backends [M] — T2: Add `store.UserIdentity` model and `Store` methods + driver interface [M] — T3: Implement SQLite driver for `user_identity` [M] — T4: Implement Postgres driver for `user_identity` [M] — T5: Implement MySQL driver for `user_identity` [M] — T6: Add store-layer tests for `user_identity` [M] — T7: Add SSO username derivation helper [M] — T8: Route SSO sign-in through `user_identity` linkage [L]

### T1: Add `user_identity` migrations + LATEST.sql updates [M]

**Objective**: Create the `user_identity` persistence structure across SQLite, Postgres, and MySQL, and reflect it in `LATEST.sql` for fresh installs (G1, G2, G3, G4, G5; design §1, §5).

**Size**: M (3 new migration files, 3 LATEST.sql edits; straightforward DDL).

**Files**:
- Create: `store/migration/sqlite/0.28/00__user_identity.sql`
- Create: `store/migration/postgres/0.28/00__user_identity.sql`
- Create: `store/migration/mysql/0.28/00__user_identity.sql`
- Modify: `store/migration/sqlite/LATEST.sql`
- Modify: `store/migration/postgres/LATEST.sql`
- Modify: `store/migration/mysql/LATEST.sql`

**Implementation**:
1. `store/migration/sqlite/0.28/00__user_identity.sql`:
   ```sql
   CREATE TABLE user_identity (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id    INTEGER NOT NULL,
     provider   TEXT    NOT NULL,
     extern_uid TEXT    NOT NULL,
     created_ts BIGINT  NOT NULL DEFAULT (strftime('%s', 'now')),
     updated_ts BIGINT  NOT NULL DEFAULT (strftime('%s', 'now')),
     UNIQUE (provider, extern_uid)
   );
   CREATE INDEX idx_user_identity_user_id ON user_identity(user_id);
   ```
2. `store/migration/postgres/0.28/00__user_identity.sql`: same logical schema with Postgres types — `id SERIAL PRIMARY KEY`, `user_id INTEGER NOT NULL`, `provider TEXT NOT NULL`, `extern_uid TEXT NOT NULL`, `created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())`, `updated_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())`, `UNIQUE(provider, extern_uid)`, plus `CREATE INDEX idx_user_identity_user_id ON user_identity(user_id);`. Include a 2-line header comment describing the table purpose (pattern-match `04__memo_share.sql`).
3. `store/migration/mysql/0.28/00__user_identity.sql`: same logical schema with MySQL syntax — backticked identifiers, `INT NOT NULL AUTO_INCREMENT PRIMARY KEY`, `VARCHAR(256)` for `provider`, `VARCHAR(256)` for `extern_uid` (so unique key fits within index limits), `BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP())` for timestamps, `UNIQUE(provider, extern_uid)`, plus `CREATE INDEX idx_user_identity_user_id ON user_identity(user_id);`.
4. Append a `-- user_identity` section to each `LATEST.sql` mirroring the corresponding migration file (schema only, same indentation style used by neighboring tables in that file).

**Boundaries**: Must NOT alter the `user` or `idp` tables; must NOT add FK from `user_identity.provider` to `idp.uid`; must NOT add columns beyond `id`, `user_id`, `provider`, `extern_uid`, `created_ts`, `updated_ts`.

**Dependencies**: None.

**Expected Outcome**: New migration files exist; `LATEST.sql` for each backend contains a `user_identity` table block and its `user_id` index.

**Validation**:
- `rg -n "CREATE TABLE user_identity" store/migration` — expects one hit per backend in both the 0.28 migration and `LATEST.sql` (6 hits total).
- `rg -n "UNIQUE ?\\(provider, extern_uid\\)" store/migration` — expects 6 hits total.
- `go build ./...` — expects PASS (no code changes affect the build; confirms no stray syntax issues).

---

### T2: Add `store.UserIdentity` model, `Store` methods, and driver interface [M]

**Objective**: Provide a Go-level abstraction for the `user_identity` record with create/read operations wired through `store.Driver` (design §2, G3, G5).

**Size**: M (one new store file, one interface edit; simple CRUD-shaped code).

**Files**:
- Create: `store/user_identity.go`
- Modify: `store/driver.go`

**Implementation**:
1. `store/user_identity.go`:
   - Types:
     ```go
     type UserIdentity struct {
         ID        int32
         UserID    int32
         Provider  string
         ExternUID string
         CreatedTs int64
         UpdatedTs int64
     }

     type FindUserIdentity struct {
         ID        *int32
         UserID    *int32
         Provider  *string
         ExternUID *string
     }
     ```
   - Store methods (thin passthroughs to driver):
     ```go
     func (s *Store) CreateUserIdentity(ctx context.Context, create *UserIdentity) (*UserIdentity, error)
     func (s *Store) ListUserIdentities(ctx context.Context, find *FindUserIdentity) ([]*UserIdentity, error)
     func (s *Store) GetUserIdentity(ctx context.Context, find *FindUserIdentity) (*UserIdentity, error) // returns (nil, nil) on no match
     ```
   - No update/delete methods in this issue (design §2: create/read only).
2. `store/driver.go`: extend the `Driver` interface with:
   ```go
   // UserIdentity model related methods.
   CreateUserIdentity(ctx context.Context, create *UserIdentity) (*UserIdentity, error)
   ListUserIdentities(ctx context.Context, find *FindUserIdentity) ([]*UserIdentity, error)
   ```
   `GetUserIdentity` in `store` can be implemented locally by calling `ListUserIdentities` with `Limit`-free semantics and returning the first row, matching the `GetMemoShare`/`GetIdentityProvider` pattern (no new driver method required for "get").

**Boundaries**: Must NOT add fields to `store.User` or `store.UpdateUser`; must NOT add update/delete methods.

**Dependencies**: None (T3–T5 will satisfy the new interface methods).

**Expected Outcome**: `store.UserIdentity`, `FindUserIdentity`, and three `Store` methods exist; `Driver` interface declares the two new methods.

**Validation**:
- `go build ./store/...` — expects FAIL until T3–T5 implement the interface on each driver. Record as expected; final pass comes at end of T5.
- `rg -n "CreateUserIdentity|ListUserIdentities" store/driver.go store/user_identity.go` — expects method declarations in both files.

---

### T3: Implement SQLite driver for `user_identity` [M]

**Objective**: Implement `CreateUserIdentity` and `ListUserIdentities` for SQLite so the interface declared in T2 is satisfied (design §2).

**Size**: M (one new driver file; mirrors existing `memo_share.go` patterns).

**Files**:
- Create: `store/db/sqlite/user_identity.go`

**Implementation**:
1. `CreateUserIdentity`:
   - Insert columns `user_id`, `provider`, `extern_uid` using `?` placeholders.
   - Use `RETURNING id, created_ts, updated_ts` to populate generated fields, same pattern as `store/db/sqlite/memo_share.go:24`.
   - Return the passed-in `create` struct with generated fields populated, or the error from `QueryRowContext(...).Scan(...)` (unique-constraint violation surfaces to caller unchanged).
2. `ListUserIdentities`:
   - `where := []string{"1 = 1"}`; append clauses for `find.ID`, `find.UserID`, `find.Provider`, `find.ExternUID` when non-nil.
   - `SELECT id, user_id, provider, extern_uid, created_ts, updated_ts FROM user_identity WHERE ... ORDER BY id ASC`.
   - Scan rows into `[]*store.UserIdentity`; return `[]*store.UserIdentity{}` on no rows (not nil).

**Boundaries**: Must NOT introduce transaction helpers, upsert semantics, or extra scan columns.

**Dependencies**: T2.

**Expected Outcome**: SQLite driver compiles and returns populated rows.

**Validation**:
- `go build ./store/db/sqlite/...` — expects PASS.

---

### T4: Implement Postgres driver for `user_identity` [M]

**Objective**: Mirror T3 for Postgres using `$N` placeholders and `SERIAL` semantics (design §2).

**Size**: M (one new driver file; mirrors `store/db/postgres/memo_share.go`).

**Files**:
- Create: `store/db/postgres/user_identity.go`

**Implementation**:
- Same shape as T3, but:
  - Use `placeholder(n)` / `placeholders(n)` helpers from `store/db/postgres/common.go`.
  - Insert stmt `INSERT INTO user_identity (user_id, provider, extern_uid) VALUES (...) RETURNING id, created_ts, updated_ts`.
  - List query identical SQL shape to SQLite (no backticks in Postgres; match `memo_share.go` style).

**Boundaries**: Same as T3.

**Dependencies**: T2.

**Expected Outcome**: Postgres driver compiles.

**Validation**:
- `go build ./store/db/postgres/...` — expects PASS.

---

### T5: Implement MySQL driver for `user_identity` [M]

**Objective**: Mirror T3/T4 for MySQL, using `LastInsertId()` + re-read pattern (MySQL's driver does not support `RETURNING`; design §2).

**Size**: M (one new driver file; mirrors `store/db/mysql/memo_share.go`).

**Files**:
- Create: `store/db/mysql/user_identity.go`

**Implementation**:
- `CreateUserIdentity`:
  - `INSERT INTO user_identity (user_id, provider, extern_uid) VALUES (?, ?, ?)` via `ExecContext`.
  - Get `LastInsertId()`, re-fetch via `GetUserIdentity(... ID: &id)` helper (internal unexported `listUserIdentitiesByID` or reuse `ListUserIdentities` with `FindUserIdentity{ID: &id}` + take first result).
  - Mirror `memo_share.go` error-handling style (return `errors.Errorf("failed to create user identity")` when re-fetch returns nil, like memo_share does).
- `ListUserIdentities`:
  - Same shape as T3, using backticked column names (`` `user_id` ``, `` `provider` ``, `` `extern_uid` ``) and `?` placeholders, matching the MySQL idiom used in `memo_share.go`.

**Boundaries**: Same as T3.

**Dependencies**: T2.

**Expected Outcome**: MySQL driver compiles; full repo builds.

**Validation**:
- `go build ./...` — expects PASS (entire repo compiles with all drivers satisfying the `Driver` interface introduced in T2).

---

### T6: Add store-layer tests for `user_identity` [M]

**Objective**: Exercise create + read paths plus the `(provider, extern_uid)` uniqueness guard across the active driver (G2).

**Size**: M (one new test file; patterns match existing store tests).

**Files**:
- Create: `store/test/user_identity_test.go`

**Implementation**:
1. `TestUserIdentityCreateAndGet`:
   - Create host user via `createTestingHostUser`.
   - `CreateUserIdentity` with `UserID=user.ID`, `Provider="idp-uid-1"`, `ExternUID="jane@example.com"`.
   - `GetUserIdentity` by `(Provider, ExternUID)` — assert match on `UserID`, `Provider`, `ExternUID`, non-zero `ID`, non-zero `CreatedTs`.
2. `TestUserIdentityListByUserID`:
   - Create two identities under the same `UserID` with two different `Provider` values.
   - `ListUserIdentities` by `UserID` — assert length 2.
3. `TestUserIdentityUniqueConflict`:
   - Insert one row with `(Provider="idp-A", ExternUID="sub-1")`.
   - Insert a second row with identical `(Provider, ExternUID)` for a different `UserID`.
   - Assert the second `CreateUserIdentity` returns a non-nil error (detection via `err != nil`; do not assert message since error strings differ per backend).
4. `TestUserIdentitySameExternUIDDifferentProviders`:
   - Insert `(Provider="idp-A", ExternUID="sub-1")` and `(Provider="idp-B", ExternUID="sub-1")` under the same or different users.
   - Assert both inserts succeed (G2: uniqueness is scoped to the pair, not `extern_uid` alone).

**Boundaries**: Must NOT test SSO sign-in or auth service behavior; must NOT test migration contents beyond what `NewTestingStore` already executes.

**Dependencies**: T1–T5.

**Expected Outcome**: All four tests pass against SQLite.

**Validation**:
- `go test ./store/test/ -run TestUserIdentity -count=1` — expects all 4 tests PASS.

---

### T7: Add SSO username derivation helper [M]

**Objective**: Produce a valid `User.Username` for new SSO-created users from profile fields, independent of `extern_uid` (design §4).

**Size**: M (one new file with helper + small unit test; self-contained logic).

**Files**:
- Create: `server/router/api/v1/sso_username.go`

**Implementation**:
1. `deriveSSOUsername(ctx context.Context, stores *store.Store, userInfo *idp.IdentityProviderUserInfo) (string, error)`:
   - Build ordered candidate list: `[userInfo.DisplayName, userInfo.Email, userInfo.Identifier]`, skipping empty values.
   - For each candidate:
     1. `base := normalizeToUsername(candidate)`
     2. If `validateUsername(base) == nil`:
        - If no existing user with `Username=base` (via `stores.GetUser(&FindUser{Username: &base})`), return `base`.
        - Else: try up to N=8 suffix retries `base + "-" + randomSuffix(6)`, where the trimmed base ensures total length ≤ 36. If a candidate passes `validateUsername` and is unique, return it.
3. If all candidates are exhausted: fall back to a purely random username `"user-" + randomSuffix(10)` validated via `validateUsername`; retry up to 5 times before returning an error.
4. `normalizeToUsername(s string) string`:
   - ASCII-fold / lowercase.
   - Replace every character not in `[a-zA-Z0-9]` with `-`.
   - Collapse consecutive `-` into one `-`.
   - Trim leading/trailing `-`.
   - Truncate to 36 chars, then re-trim trailing `-` so the string still ends in alphanumeric.
   - Return `""` if the result is empty or fully numeric (so the caller falls through to the next candidate).
5. Use `internal/util.RandomString` for the random suffix (already imported by `auth_service.go`).

**Boundaries**: Must NOT modify `validateUsername` or `base.UIDMatcher`; must NOT write to `user_identity` or `user` directly; must NOT call `CreateUser`.

**Dependencies**: None.

**Expected Outcome**: New file `server/router/api/v1/sso_username.go` containing the exported-for-package helper `deriveSSOUsername` and internal `normalizeToUsername`.

**Validation**:
- `go build ./server/router/api/v1/...` — expects PASS.
- `go vet ./server/router/api/v1/...` — expects PASS.

---

### T8: Route SSO sign-in through `user_identity` linkage [L]

**Objective**: Replace the `FindUser{Username: &userInfo.Identifier}` lookup and `Username: userInfo.Identifier` user creation with `user_identity`-backed lookup and derived-username user creation, satisfying G1 and G2 end-to-end (design §3).

**Size**: L (non-trivial branching logic: lookup, miss path, registration gate, race recovery).

**Files**:
- Modify: `server/router/api/v1/auth_service.go`

**Implementation** (in `SignIn`, SSO branch, replacing current lines ~124–173):

1. After `identifier_filter` check succeeds (existing `lines 124-133` unchanged), resolve the linkage:
   ```go
   provider := identityProvider.Uid
   externUID := userInfo.Identifier
   existingIdentity, err := s.Store.GetUserIdentity(ctx, &store.FindUserIdentity{
       Provider:  &provider,
       ExternUID: &externUID,
   })
   // error handling → codes.Internal
   ```
2. **Hit path**: if `existingIdentity != nil`, load `s.Store.GetUser(ctx, &store.FindUser{ID: &existingIdentity.UserID})`; set `existingUser`; skip creation.
3. **Miss path**: gate on `instanceGeneralSetting.DisallowUserRegistration` (reuse existing flow at current lines 143–149), then:
   1. `username, err := deriveSSOUsername(ctx, s.Store, userInfo)` — from T7. `codes.Internal` on error.
   2. Generate random password + bcrypt hash (unchanged from current lines 160–168).
   3. `user, err := s.Store.CreateUser(ctx, &store.User{Username: username, Role: store.RoleUser, Nickname: userInfo.DisplayName, Email: userInfo.Email, AvatarURL: userInfo.AvatarURL, PasswordHash: string(passwordHash)})`.
   4. `_, err := s.Store.CreateUserIdentity(ctx, &store.UserIdentity{UserID: user.ID, Provider: provider, ExternUID: externUID})`.
   5. **Race recovery**: if `CreateUserIdentity` returns an error whose message matches one of the known unique-constraint markers (`strings.Contains(err.Error(), "UNIQUE constraint failed")`, `"duplicate key"`, `"Duplicate entry")` — reusing the same pattern as `server/router/api/v1/memo_service.go:103–105`):
      - `_ = s.Store.DeleteUser(ctx, &store.DeleteUser{ID: user.ID})` (best-effort cleanup of the provisional local user).
      - Re-read the winning `user_identity` via `s.Store.GetUserIdentity(ctx, &FindUserIdentity{Provider: &provider, ExternUID: &externUID})`; if still nil, return `codes.Internal` (should not happen under correct semantics).
      - Load its user via `s.Store.GetUser(ctx, &FindUser{ID: &winner.UserID})`; set `existingUser`.
   6. On any other `CreateUserIdentity` error: best-effort `DeleteUser` cleanup, then return `codes.Internal`.
   7. On full success: set `existingUser = user`.

4. Leave the remainder of `SignIn` (row-status check, `doSignIn`, response construction) untouched.

**Boundaries**: Must NOT touch the password-credentials branch; must NOT modify `identifier_filter` logic; must NOT touch `doSignIn`, `SignOut`, or `RefreshToken`; must NOT add new fields to `SignInRequest`/`SignInResponse`.

**Dependencies**: T2, T3, T6 minimum for SQLite confidence; T7 for the derivation helper.

**Expected Outcome**:
- Sign-in with an IdP-issued identifier that fails `base.UIDMatcher` (e.g., `jane@example.com`) succeeds: a `user_identity` row is created, and the local `User.Username` is a derived valid username.
- Repeat sign-in for the same `(provider, extern_uid)` pair loads the same user by linkage, not by username.
- Two IdPs emitting the same `extern_uid` can each link to their own local users without colliding (G2).

**Validation**:
- `go build ./...` — expects PASS.
- `go vet ./...` — expects PASS.
- `go test ./store/test/ -run TestUserIdentity -count=1` — expects PASS (T6 regression check; ensures no store-layer drift).

## Out-of-Scope Tasks

The following are explicitly deferred per `definition.md` / `design.md` and will NOT be attempted during this execution:

- UI or API surfaces for linking/unlinking external identities.
- Update or delete paths for `user_identity` rows.
- Backfill / migration of existing users whose current `Username` matches an IdP identifier.
- Non-OAUTH2 IdP types.
- Protobuf or API changes to `SignInRequest`/`SignInResponse`.
- Adding foreign keys between `user_identity.provider` and `idp.uid`.
- Running PostgreSQL or MySQL integration tests locally (validation commands only cover SQLite, which is the default `DRIVER` in `store/test/store.go`).
