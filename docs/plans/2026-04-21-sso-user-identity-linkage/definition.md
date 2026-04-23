## Background & Context

SSO sign-in in memos currently treats the IdP-provided identifier as the local username. The identifier value comes from the OAuth2 UserInfo claim named in `FieldMapping.identifier`, while local usernames are validated by `validateUsername` against `base.UIDMatcher`. Real IdPs frequently emit identifiers such as email addresses, opaque subject IDs, or provider-specific account IDs that are valid authentication subjects but are not valid memos usernames.

The existing issue artifacts under `docs/plans/2026-04-21-sso-user-identity-linkage/` already scope a persistent linkage between SSO identities and local users. A broader review of upstream open source schemas now shows that similar systems converge on separating external identity from the local user row, but do not converge on one universal table name or one exact column set. That difference matters because the implementation problem is narrower than "copy one upstream schema exactly" and broader than "pick any new table name locally."

## Issue Statement

The SSO sign-in path in `server/router/api/v1/auth_service.go` resolves and creates users from `userInfo.Identifier` through `User.Username`, and no provider-scoped external identity record exists to resolve a local user independently of that username; as a result, provider-issued identifiers that are valid authentication subjects but invalid memos usernames fail the sign-in path, and the future persistence model still requires an explicit schema decision among several verified upstream identity-link patterns.

## Current State

**Sign-in path** — `server/router/api/v1/auth_service.go:124-173`
- Lines 124-132 apply `identifier_filter` to `userInfo.Identifier`.
- Lines 135-137 call `GetUser(FindUser{Username: &userInfo.Identifier})`.
- Lines 151-159 create a new `store.User` with `Username: userInfo.Identifier`.
- No persistent linkage record is read or written during SSO sign-in.

**Username validation** — `server/router/api/v1/user_resource_name.go:33-38`
- `validateUsername` rejects empty strings, fully numeric usernames, and values that fail `base.UIDMatcher`.
- `base.UIDMatcher` is defined in `internal/base/resource_name.go:5-6` as `^[a-zA-Z0-9]([a-zA-Z0-9-]{0,34}[a-zA-Z0-9])?$`.

**User model** — `store/user.go:26-77`
- `store.User` contains `Username`, `Email`, `Nickname`, `AvatarURL`, and other local account fields.
- `store.FindUser` supports lookup by `ID`, `Username`, `Email`, and related filters.
- No external identity field exists on the user model.

**Current database schema** — `store/migration/sqlite/LATEST.sql:9-79`
- `user` table (`lines 10-22`) stores `username` as a unique column and has no external identity column.
- `idp` table (`lines 72-79`) stores `uid` as the stable identifier for an IdP instance.
- The latest checked-in migration version is `0.27` under all three backends (`store/migration/sqlite/0.27`, `store/migration/postgres/0.27`, `store/migration/mysql/0.27`).

**IdP user info mapping** — `internal/idp/idp.go:3-8`, `internal/idp/oauth2/oauth2.go:105-129`
- `IdentityProviderUserInfo` carries `Identifier`, `DisplayName`, `Email`, and `AvatarURL`.
- `Identifier` is loaded from the configured claim and is required to be non-empty.
- `DisplayName` falls back to `Identifier` when not mapped.

**No existing linkage persistence**
- No `identity`, `identities`, `user_identity`, `external_login_user`, or similar structure exists anywhere under `store/`.

## Non-Goals

- Changing `UIDMatcher` or `validateUsername`.
- Changing how `FieldMapping` maps OAuth2 claims into `IdentityProviderUserInfo`.
- Changing how password-based local sign-in works.
- Changing `identifier_filter` behavior.
- Supporting IdP types other than `OAUTH2` in this issue.
- Providing UI or API surfaces for linking or unlinking external identities.
- Migrating or renaming existing usernames already stored in `user`.
- Automatically linking pre-existing users whose current `User.Username` happens to match an IdP identifier.
- Adding SCIM, directory sync, or per-group / multi-tenant IdP scoping.
- Storing provider access tokens or profile payloads unless a live memos code path requires them.

## Open Questions

1. When a new SSO user's `userInfo.Identifier` does not yield a valid username, what value is used as the initial `User.Username`? (default: derive from `DisplayName`, then `Email`, then `Identifier`, normalizing to a valid username and retrying with a short suffix on collision)

2. Should an existing local user be linkable to an SSO identity after registration? (default: no — out of scope for this issue)

3. Should one local user be linkable to multiple external identities across different IdP instances? (default: yes — allow multiple rows per `user_id`, one per provider-scoped external identifier)

4. What schema vocabulary should represent the provider-scoped external identity record? (default: use table `user_identity` to match current memos table naming, with `provider` and `extern_uid` as the stored linkage fields)

5. Should the linkage schema store only lookup fields or also provider metadata such as tokens and raw profile data? (default: lookup fields only for this issue)

6. Should the linkage table be added across SQLite, PostgreSQL, and MySQL? (default: yes — mirror the existing migration strategy across all supported backends)

## Scope

**L** — the work still spans a new persistence structure across three database backends, store-layer types and driver implementations, sign-in path changes, username derivation behavior, and now an explicit design choice among several verified upstream schema patterns rather than a single assumed naming scheme.
