## Background & Context

SSO sign-in via `auth_service.SignIn` maps the IdP `Identifier` claim directly to `User.Username`. For many OAuth2 providers (Google, GitHub, most OIDC providers) the `Identifier` field resolves to an email address or other value that fails `validateUsername` (which enforces `base.UIDMatcher`: `^[a-zA-Z0-9]([a-zA-Z0-9-]{0,34}[a-zA-Z0-9])?$`).

PR #5856 extended `UIDMatcher` to 36 chars to accommodate UUIDv4 `sub` claims. PR #5863 (open) introduces a relaxed validator for the read path so existing email-shaped rows remain addressable. Neither fix the write path: new SSO sign-ins still produce usernames that violate `validateUsername` when the admin has pointed `FieldMapping.identifier` at an email-bearing claim.

Admins can avoid the problem today by pointing `FieldMapping.identifier` at the `sub` claim. However there is no mechanism to derive a valid username from an identifier value that is already in storage, and no way to apply per-IdP transformation logic without code changes.

## Issue Statement

No per-IdP mechanism exists to transform the raw `Identifier` value returned by `oauth2.IdentityProvider.UserInfo` into a form that satisfies `validateUsername` before it is written to `User.Username` or used to look up an existing user; admins whose IdP returns email-shaped or otherwise non-conforming identifiers have no path to define that transformation in the IdP configuration.

## Current State

**Proto definitions**
- `proto/store/idp.proto` — `storepb.IdentityProviderConfig` has a `oneof config { OAuth2Config oauth2_config = 1; }` with no transform field.
- `proto/api/v1/idp_service.proto` — `v1pb.IdentityProviderConfig` mirrors the same structure. `FieldMapping` has `identifier`, `display_name`, `email`, `avatar_url`.

**Store layer**
- `store/idp.go` — config is serialized as raw `OAuth2Config` JSON into the `config` column via `convertIdentityProviderConfigToRaw` / `convertIdentityProviderConfigFromRaw`.
- `store/db/sqlite/idp.go`, `store/db/postgres/idp.go`, `store/db/mysql/idp.go` — SQL reads/writes 6 columns: `id`, `uid`, `name`, `type`, `identifier_filter`, `config`.

**Schema**
- `store/migration/sqlite/LATEST.sql` — `idp` table: `id`, `uid`, `name`, `type`, `identifier_filter TEXT NOT NULL DEFAULT ''`, `config TEXT NOT NULL DEFAULT '{}'`. No transform column.
- `store/migration/postgres/LATEST.sql` — same logical schema; `config JSONB`.
- `store/migration/mysql/LATEST.sql` — same; `identifier_filter VARCHAR(256)`, `config TEXT`.

**Sign-in path**
- `server/router/api/v1/auth_service.go` — `store.GetUser` and `store.CreateUser` both use `userInfo.Identifier` directly as the username with no transformation.

**IdP service converters**
- `server/router/api/v1/idp_service.go` — `convertIdentityProviderFromStore` / `convertIdentityProviderToStore` / `convertIdentityProviderConfigToStore` have no transform field. `UpdateIdentityProvider` update_mask switch handles `"title"`, `"identifier_filter"`, `"config"` only.

**No expression evaluator dependency** — `go.mod` has no `expr-lang/expr` or any expression/scripting engine.

## Non-Goals

- Changing `UIDMatcher` or any existing username validation rule.
- Migrating existing rows that have email-shaped usernames.
- Adding transform support for IdP types other than OAUTH2 in this issue (only one type exists today).
- Providing a UI editor for the transform expression (API surface only).
- Supporting multi-statement scripting logic (loops, variable assignment, async).
- Changing how `identifier_filter` (regex allow/deny) works.
- Applying the transform to the `DisplayName`, `Email`, or `AvatarURL` fields.
- Schema migration — `identifier_transform` is stored inside the existing `config` JSON blob, not as a new column.

## Open Questions

1. Should `identifier_transform` live as a new column on the `idp` table or inside the existing `IdentityProviderConfig` JSON blob? **Decided: inside `IdentityProviderConfig` — no schema migration required.**

2. What expression engine should be used? **Decided: `github.com/expr-lang/expr` — pure Go, no CGo, no loops possible so no timeout needed, ~500KB binary impact vs ~5MB for a JS engine.**

3. What is the expression contract — named function or single expression? **Decided: single `expr-lang` expression string receiving `identifier` variable. Example: `lower(split(identifier, "@")[0])`.**

4. Should an expression returning an empty string or non-string be a hard error or a silent fallback? **Decided: hard error — silent fallback masks misconfiguration.**

5. Should the expression be validated at save time? **Decided: yes — `expr.Compile` is called at `CreateIdentityProvider` and `UpdateIdentityProvider` to reject invalid expressions before persisting.**

## Scope

**L** — Requires a new third-party dependency (`expr-lang/expr`), changes to two proto files and their generated code, backward-compatible config serialization logic, a new expression executor with tests, and wiring through service → auth layers.
