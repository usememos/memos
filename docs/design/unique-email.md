# Unique Email Design

> Moved to [`.archcore/users/unique-email.adr.md`](../../.archcore/users/unique-email.adr.md) and [`.archcore/users/email-contract.spec.md`](../../.archcore/users/email-contract.spec.md).

## Summary

> Moved to [`.archcore/users/unique-email.adr.md`](../../.archcore/users/unique-email.adr.md).

## Goals

> Moved to [`.archcore/users/unique-email.adr.md`](../../.archcore/users/unique-email.adr.md) and [`.archcore/users/email-contract.spec.md`](../../.archcore/users/email-contract.spec.md).

## Non-goals

> Moved to [`.archcore/users/email-contract.spec.md`](../../.archcore/users/email-contract.spec.md).

## Current state

Facts verified in the code on 2026-09-12:

- All three fresh-install schemas declare `email` as `NOT NULL DEFAULT ''` with no index. MySQL declares no collation on the column, so it inherits the server default, which is usually case-insensitive; SQLite and PostgreSQL compare bytewise. The same two values may or may not collide depending on the driver.
- No write path validates the address. `util.ValidateEmail` exists in `internal/util` but has no callers outside its test.
- Four code paths write an address: first-user bootstrap and ordinary creation in `CreateUser`, the `email` update-mask path in `UpdateUser`, and `createSSOUser`, which copies the mapped address from the identity provider without inspection.
- The web signup form collects no email. On most self-hosted installs the column is `''` for nearly every row. Non-empty values come from the profile settings page, admin-created accounts, and SSO.
- Migrations are plain SQL files applied inside one transaction per driver, with no Go step before or after a file runs. MySQL DDL commits implicitly, so a multi-statement MySQL migration is not atomic in practice.
- The SSO creation path retries on any unique-constraint violation on the assumption that the conflict is the username or the identity linkage. A unique email index adds a third cause that the retry loop does not understand.

## Proposed design

> Moved to [`.archcore/users/email-contract.spec.md`](../../.archcore/users/email-contract.spec.md).

### Canonical form

No domain-must-contain-a-dot rule is applied; the RFC allows dotless hosts, and ownership is a verification concern, not a format one.

## Alternatives considered

> Moved to [`.archcore/users/unique-email.adr.md`](../../.archcore/users/unique-email.adr.md).

## Deferred design

> Moved to [`.archcore/users/unique-email.adr.md`](../../.archcore/users/unique-email.adr.md).
