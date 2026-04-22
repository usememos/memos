## References

1. **GitLab `db/init_structure.sql` — `identities` table** (verified)
   https://gitlab.com/gitlab-org/gitlab/-/raw/master/db/init_structure.sql?ref_type=heads
   GitLab stores external identities in a separate `identities` table with fields including `extern_uid`, `provider`, `user_id`, `created_at`, and `updated_at`, plus provider-specific extensions such as `saml_provider_id`.

2. **Gitea `models/user/external_login_user.go` — `ExternalLoginUser`** (verified)
   https://raw.githubusercontent.com/go-gitea/gitea/main/models/user/external_login_user.go
   Gitea persists external account links separately from the user row. The core linkage fields are `ExternalID`, `LoginSourceID`, and `UserID`, with optional provider metadata and tokens.

3. **Discourse `app/models/user_associated_account.rb` — `user_associated_accounts`** (verified)
   https://raw.githubusercontent.com/discourse/discourse/main/app/models/user_associated_account.rb
   Discourse uses a dedicated association table with `provider_name`, `provider_uid`, `user_id`, timestamps, and JSONB metadata. It enforces uniqueness on both `(provider_name, provider_uid)` and `(provider_name, user_id)`.

4. **Keycloak `FederatedIdentityEntity.java` — `FEDERATED_IDENTITY`** (verified)
   https://raw.githubusercontent.com/keycloak/keycloak/main/model/jpa/src/main/java/org/keycloak/models/jpa/entities/FederatedIdentityEntity.java
   Keycloak models brokered identities separately with `USER_ID`, `IDENTITY_PROVIDER`, `FEDERATED_USER_ID`, `FEDERATED_USERNAME`, `REALM_ID`, and `TOKEN`, using provider-scoped lookup queries rather than local username lookup.

5. **Immich `user.table.ts` and initial migration — `users.oauthId`** (verified)
   https://raw.githubusercontent.com/immich-app/immich/main/server/src/schema/tables/user.table.ts
   https://raw.githubusercontent.com/immich-app/immich/main/server/src/schema/migrations/1744910873969-InitialMigration.ts
   Immich stores a single `oauthId` column directly on the `users` table instead of a separate linkage table.

6. **Mattermost `server/public/model/user.go` — `AuthData` and `AuthService` on `User`** (verified)
   https://raw.githubusercontent.com/mattermost/mattermost/master/server/public/model/user.go
   Mattermost stores external-auth linkage directly on the user model through `AuthData` and `AuthService`.

## Industry Baseline

There is no single universal table name for SSO identity linkage across open source systems. The consistent pattern is structural rather than nominal: systems that support multiple external providers or explicit account linking separate the external identity from the local username and from the core user row.

Three recurring schema families appear in the references:

- **Provider-scoped identity-link table**. GitLab `identities` and Gitea `ExternalLoginUser` both persist a provider discriminator, an external identifier, and a local `user_id` in a separate structure. This is the most direct fit when one local user may be linked to multiple IdPs.
- **Association table with richer metadata**. Discourse `user_associated_accounts` uses the same provider-plus-external-id pattern, but also stores provider payloads and enforces one account per provider per user.
- **User-row coupling**. Immich and Mattermost place the external identifier on the user row itself. This minimizes schema surface area, but it ties the user record to one external binding shape and reduces flexibility when multiple providers or multiple linked identities are in scope.

Keycloak's `FEDERATED_IDENTITY` falls in the separate-table family as well, but introduces an additional realm scope and stores broker-specific metadata because Keycloak is itself an identity broker rather than an application with a local username model.

Known trade-offs:

- Separate tables add one extra lookup during sign-in compared with `GetUser(Username)`, but they avoid coupling authentication subjects to user-facing usernames.
- Richer association tables support future linking, unlinking, and metadata sync, but they increase write paths and retention of provider data.
- User-row columns are simpler for one-provider or one-link systems, but they do not fit a product that already supports multiple configured IdP instances.

## Research Summary

- GitLab, Gitea, Discourse, and Keycloak all separate the external identity record from the local username.
- The recurring core fields are a **provider scope**, an **external subject/UID**, and a **local user ID**. Exact names vary: `provider`, `login_source_id`, `provider_name`, `identity_provider`, `extern_uid`, `external_id`, `provider_uid`, `federated_user_id`.
- Table naming is not standardized across projects. `identities` is common and recognizable, but `external_login_user`, `user_associated_accounts`, and `FEDERATED_IDENTITY` are also established patterns.
- Single-column user-row designs such as Immich `oauthId` and Mattermost `AuthData` / `AuthService` are simpler, but they align with products that bind one external identity shape directly to the user row rather than a product that already has multiple `idp` records.
- For memos, the verified references support a provider-scoped link table and do not support continuing to use `User.Username` as the external identity lookup key. They also suggest that `provider` and `extern_uid` are clearer linkage-field names than repo-specific names like `idp_id`, even if the table name itself follows memos naming conventions.

## Design Goals

1. **G1 — Username-independent lookup**: SSO sign-in resolves an existing user without requiring `userInfo.Identifier` to pass `validateUsername`. Verifiable: a sign-in flow with `Identifier = "jane@example.com"` or an opaque subject string reaches user lookup through the linkage table, not through `FindUser{Username: ...}`.

2. **G2 — Provider-scoped uniqueness**: Two configured IdP instances may issue the same external identifier string without colliding. Verifiable: uniqueness is enforced on the pair `(provider, extern_uid)`, not on `extern_uid` alone.

3. **G3 — No new external-auth column on `user`**: The local `user` table remains a local account record rather than the storage site for external identity subjects. Verifiable: migration files do not add `oauth_id`, `auth_data`, `provider_uid`, or similar columns to `user`.

4. **G4 — Repo-aligned table naming with reference-aligned linkage fields**: The new linkage schema follows memos table naming conventions while using linkage field names that map directly to upstream patterns. Verifiable: the design uses table `user_identity` together with fields `provider` and `extern_uid`.

5. **G5 — Minimal persistence surface for this issue**: The linkage record stores lookup fields required by sign-in and excludes provider payloads that no current memos code path reads. Verifiable: the initial schema contains no token, JSON payload, or raw-profile columns.

## Non-Goals

All non-goals from `definition.md` apply. Additionally:

- Matching GitLab, Gitea, Discourse, or Keycloak field-for-field beyond the linkage concepts required by memos.
- Adding SCIM-, SAML-, or realm-specific columns such as Keycloak `REALM_ID` or GitLab `saml_provider_id`.
- Enforcing a one-provider-per-user rule like Discourse's `(provider_name, user_id)` uniqueness.
- Storing provider tokens, raw payloads, or synchronization metadata in the initial linkage table.

## Proposed Design

### 1. Use a separate `user_identity` table

Adopt the separate-table family used by GitLab `identities`, Gitea `ExternalLoginUser`, Discourse `user_associated_accounts`, and Keycloak `FEDERATED_IDENTITY`, while keeping the stored fields limited to what memos currently needs for sign-in (G1, G2, G3, G5). The table name should follow memos' existing singular / relationship-style naming pattern rather than copying GitLab's pluralized table name directly (G4).

Proposed logical schema:

```sql
CREATE TABLE user_identity (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  provider   TEXT NOT NULL,   -- stores idp.uid
  extern_uid TEXT NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  UNIQUE (provider, extern_uid)
);

CREATE INDEX user_identity_user_id_idx ON user_identity(user_id);
```

Naming decisions:

- **`user_identity`** follows the repo's current table naming pattern. Existing memos tables are singular or singular relationship tables such as `user`, `memo`, `memo_relation`, `memo_share`, and `idp`, so `user_identity` is more consistent locally than GitLab's plural `identities` (G4).
- **`provider`** is the stored `idp.uid`. This maps directly to GitLab `provider`, Keycloak `IDENTITY_PROVIDER`, Discourse `provider_name`, and Gitea's effective provider scope via `LoginSourceID`.
- **`extern_uid`** uses GitLab's term for the provider-issued subject and avoids coupling the schema to a specific protocol word such as `sub`, `email`, or `external_id`.

Rejected alternatives:

- **`identities`**: recognizable from GitLab, but inconsistent with the repo's current schema naming pattern.
- **`user_identity` with `idp_id`**: workable on naming, but less reference-aligned on the linkage fields than `provider` / `extern_uid`.
- **Add `oauth_id`-style column(s) to `user`**: simpler, but inconsistent with memos supporting multiple `idp` rows and weaker on G2 and G3, matching the Immich and Mattermost trade-off rather than the multi-provider references.

No foreign key is proposed from `provider` to `idp.uid` in the initial design. The current memos migrations do not rely heavily on cross-backend foreign-key behavior, and the linkage record must remain stable even if IdP rows are reworked at the application layer.

### 2. Add a dedicated store model and driver methods

Add a new store module for the linkage record instead of extending `store.User` (G3):

- `store/user_identity.go`
- `store/db/sqlite/user_identity.go`
- `store/db/postgres/user_identity.go`
- `store/db/mysql/user_identity.go`

The store type should mirror the lookup schema:

- `UserIdentity`: `ID`, `UserID`, `Provider`, `ExternUID`, `CreatedTs`, `UpdatedTs`
- `FindUserIdentity`: `Provider`, `ExternUID`, `UserID`

Only create and read operations are required in this issue. Update and delete paths are deferred because no current sign-in flow needs them (G5). The create path must surface provider/external-UID uniqueness conflicts so the sign-in flow can reconcile concurrent first-login races instead of leaving an unlinked local user behind.

### 3. Route SSO lookup through the linkage record

Change the `auth_service.SignIn` SSO branch so that, after `identifier_filter` passes, the flow is:

1. Resolve the current IdP instance from `idp.uid`.
2. Query `user_identity` by `(provider = idp.uid, extern_uid = userInfo.Identifier)`.
3. On hit, load the local user by `user_id`.
4. On miss, apply the existing registration gate, derive a valid local username from display-oriented fields, and execute local user creation plus `user_identity` insertion in a single transaction.
5. If the `user_identity` insert loses a race on the unique `(provider, extern_uid)` key, discard the provisional linkage result, re-read `user_identity`, and continue sign-in using the winning row's `user_id`.

This directly addresses the current runtime coupling in `server/router/api/v1/auth_service.go:135-169` and satisfies G1 and G2. `User.Username` becomes a local account attribute again instead of the SSO subject store, and the miss path becomes idempotent under concurrent first sign-ins for the same external identity.

### 4. Keep username derivation separate from external identity persistence

The initial local username for new SSO-created users should be derived from user-facing profile data rather than copied from `extern_uid`:

- first choice: `DisplayName`
- fallback: `Email`
- fallback: `Identifier`

Normalization and collision handling remain local username concerns, not identity-link concerns. This keeps the `user_identity` table focused on lookup semantics (G1, G5) and avoids implying that external identifiers must resemble usernames.

### 5. Versioned migrations across all three backends

Add a new migration version after `0.27` for SQLite, PostgreSQL, and MySQL. Update `LATEST.sql` for each backend to include the `user_identity` table and its `user_id` index.

The migrations should preserve the same logical fields across backends:

- `id`
- `user_id`
- `provider`
- `extern_uid`
- `created_ts`
- `updated_ts`
- unique key on `(provider, extern_uid)`
- secondary index on `user_id`

The implementation derived from these migrations should treat `(provider, extern_uid)` as both the lookup key and the concurrency guard for first login. A uniqueness conflict on that pair is a recoverable race outcome, not an unrecoverable error path.

### 6. Document the pattern families explicitly in the issue docs

Keep the issue docs explicit that memos is selecting one member of a broader family of established designs:

- GitLab / Gitea / Keycloak / Discourse: separate identity record
- Immich / Mattermost: user-row external-auth fields

That distinction matters because the design choice is not "copy GitLab exactly"; it is "use the multi-provider separate-identity family, keep memos-compatible table naming, and adopt upstream-aligned linkage fields where they improve recognizability" (G4).
