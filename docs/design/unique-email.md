# Unique Email Design

Status: Accepted

Date: 2026-09-12

Existing domain language: [Memos context](../../CONTEXT.md)

Related: [Multi-Spaces Design](multi-spaces.md), [ADR 0002: Username Format and References](../adr/0002-username-format-and-references.md)

## Summary

A user's email address becomes an optional, normalized, instance-unique attribute. Today `user.email` is `TEXT NOT NULL DEFAULT ''`, is never validated, is never compared, and can hold the same value on any number of accounts. Nothing in Memos depends on it beyond notification delivery and the SSO field mapping. Before email can carry verification, password reset, billing receipts, or abuse signals, it has to identify at most one account.

The change makes the column nullable, stores one canonical form, enforces uniqueness with a database index on all three drivers, and resolves existing duplicates deterministically during migration. The API keeps `email` as a plain string where empty means none.

## Goals

- At most one account per email address on an instance, enforced by the database.
- One canonical stored form so `Alice@Example.com` and `alice@example.com` are the same address on SQLite, MySQL, and PostgreSQL alike.
- Reject malformed addresses on every write path: self-service signup, admin creation, profile update, and SSO first login.
- A migration that leaves every existing install with a consistent, constraint-satisfying table, and tells the operator what it changed.
- No change to the wire representation of `User.email` and no change to what a self-hoster sees when no address is set.

## Non-goals

- Email verification, ownership proof, or a verified flag. This design makes the address unique, not trusted.
- Sign-in by email address.
- Linking an SSO identity to an existing account because the identity provider reports the same address.
- Plus-address or dot folding (`a+b@gmail.com` versus `a@gmail.com`). Those are provider conventions, not identity.
- Internationalized domain normalization beyond lowercasing.
- Rate limiting or enumeration resistance on signup. See [Signup Abuse Controls](signup-abuse-controls.md).

## Current state

Facts verified in the code on 2026-09-12:

- All three fresh-install schemas declare `email` as `NOT NULL DEFAULT ''` with no index. MySQL declares no collation on the column, so it inherits the server default, which is usually case-insensitive; SQLite and PostgreSQL compare bytewise. The same two values may or may not collide depending on the driver.
- No write path validates the address. `util.ValidateEmail` exists in `internal/util` but has no callers outside its test.
- Four code paths write an address: first-user bootstrap and ordinary creation in `CreateUser`, the `email` update-mask path in `UpdateUser`, and `createSSOUser`, which copies the mapped address from the identity provider without inspection.
- The web signup form collects no email. On most self-hosted installs the column is `''` for nearly every row. Non-empty values come from the profile settings page, admin-created accounts, and SSO.
- Migrations are plain SQL files applied inside one transaction per driver, with no Go step before or after a file runs. MySQL DDL commits implicitly, so a multi-statement MySQL migration is not atomic in practice.
- The SSO creation path retries on any unique-constraint violation on the assumption that the conflict is the username or the identity linkage. A unique email index adds a third cause that the retry loop does not understand.

## Proposed design

### Canonical form

An address is stored only in its canonical form, produced by one function shared by the API and the store:

1. Trim surrounding whitespace.
2. Accept an empty value after trimming as "no address"; it is stored as `NULL` and the remaining steps do not apply.
3. Reject if longer than 254 bytes.
4. Parse with `net/mail.ParseAddress`. Reject if parsing fails or if the parsed address differs from the input, which excludes display-name forms such as `Alice <alice@example.com>`.
5. Lowercase the whole string.

Both the local part and the domain are lowercased. Every mainstream provider treats the local part case-insensitively, and treating it as case-sensitive would let two accounts claim what users experience as one address. No domain-must-contain-a-dot rule is applied; the RFC allows dotless hosts, and ownership is a verification concern, not a format one.

The stored value is the canonical value. Users lose their original casing on display. That trade is accepted in exchange for one column, one index, and no second normalized column to keep in sync.

### Persistence

```text
user.email  NULL means no address; never ''; always canonical
UNIQUE INDEX idx_user_email ON user(email)
```

Per driver:

- SQLite: `email TEXT COLLATE BINARY DEFAULT NULL`. A unique index treats each `NULL` as distinct.
- MySQL: `email VARCHAR(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL`. A unique index allows any number of `NULL` rows. The explicit binary collation matches `username` and removes the dependence on the server default; case folding happens in the application, not the database.
- PostgreSQL: `email TEXT COLLATE "C" DEFAULT NULL`. Unique indexes treat `NULL` values as distinct by default.

Nullable is chosen over a partial unique index because MySQL has no partial indexes and a generated-column workaround would make the three schemas diverge. With a nullable column the schema, the index, and the driver code are the same shape everywhere.

The Go type `store.User.Email` stays `string`. The driver boundary maps `""` to `NULL` on write and `NULL` to `""` on read. Callers never see `NULL`. `FindUser.Email` trims and lowercases its argument before querying, so a lookup with different casing still hits the index; an empty lookup returns nothing rather than every user without an address.

### Migration

The change ships as `0.31/07__unique_email.sql` for each driver, plus matching `LATEST.sql` updates. The unique index is always the last statement, so a failure part-way through never leaves a constraint over unrepaired data.

Data repair, the same on every driver:

1. Canonicalize: `email = LOWER(TRIM(email))`.
2. Clear values with no `@`, and values containing `<`, `>`, or an interior space, which only appear in display-name forms and other junk the API would refuse. Full validation is not expressible in portable SQL; this removes the cases that would otherwise let a second account claim the bare form of a stored address. Other malformed values, such as oversized ones, stay until the user next edits the field, at which point the API rejects them.
3. Resolve duplicates: for each canonical value held by more than one row, the row with the lowest `id` keeps it and every other row is cleared. Lowest `id` is the oldest account, which is the most likely to be the one still in use and the one an admin can identify. MySQL cannot select from the table being updated, so its statement wraps the survivor set in a derived table.
4. Convert `''` to `NULL`.

DDL and ordering per driver:

- SQLite cannot alter a column's nullability. Repair runs against the old table, then the migration rebuilds `user` the way `0.31/03__multi_spaces.sql` rebuilds `memo`: create `user_new` with the final column definition, copy every row with `NULLIF(email, '')`, carry the `sqlite_sequence` entry across so ids of deleted users are never reused, drop, rename.
- MySQL switches the column to `utf8mb4_bin` and nullable first, then repairs. Grouping under the server's default collation could treat accent variants as one address and clear one of them needlessly; under the binary collation the repair compares bytes, which is what the application does.
- PostgreSQL alters the column, then repairs, all inside the migration transaction.

Then the unique index is created, guarded with `IF NOT EXISTS` on SQLite and PostgreSQL and with a prepared-statement check on MySQL, so the file is a no-op on a database that already carries it. The store test suite rewinds the schema version on fresh installs to exercise individual migrations, and every later migration has to tolerate that.

SQL `LOWER` is not a reliable canonicalizer: SQLite folds ASCII only and PostgreSQL does the same under a C locale, so `Ä@example.com` and `ä@example.com` could both survive deduplication and the index would then permit a canonical collision. The migrator therefore gains one targeted pre-flight, not a general hook system. When the stored schema version is below this migration's version, a Go function reads every non-empty address ordered by id and first rewrites any row whose stored value differs from its Unicode-lowercased, trimmed form, so the SQL that follows sees exactly the canonical values `NormalizeEmail` would produce. It then applies the migration's rules in memory and logs one warning per duplicate group naming the username that keeps the address and the usernames that will be cleared, plus one line listing the users whose value will be cleared as malformed. Addresses themselves are not logged; usernames are enough for the operator to find the accounts. A failure in either step is logged and never blocks the migration. The log is the record. Nothing else stores the cleared values. Cleared accounts can set an address again from the profile page.

A fresh install gets the final schema from `LATEST.sql` and never runs the repair.

### Write paths

Every write goes through the canonical-form function in the API layer, which returns `InvalidArgument` with the reason. The store canonicalizes again defensively, since store methods are also reached by tests and by the seed path.

- `CreateUser`: applies to the first-user bootstrap, admin creation, and self-service signup alike. `validate_only` performs the same checks without writing.
- `UpdateUser` with `email` in the mask: an empty string clears the address.
- `createSSOUser`: the mapped address from the identity provider is canonicalized. If it is malformed, or if another account already holds it, the new account is created with no address and a warning is logged naming the provider and the external identifier. The identity is never linked to the existing holder; an identity provider's claim about an address is not proof of ownership on this instance.

The store returns typed sentinels, `store.ErrEmailTaken`, `store.ErrUsernameTaken`, and `store.ErrUserIdentityTaken`, by classifying the driver's unique-violation error by the constraint named after the driver's marker text: MySQL and PostgreSQL name the key in the message and SQLite names the column. Only the text after the marker is inspected, so a duplicate value that happens to contain the word `email` cannot be misclassified. The substring-matching helper in the SSO path is replaced by this classifier, so the SSO retry loop retries only on a username collision, reconciles only on an identity collision, and drops the address only on an email collision. Without this, an email collision would be misread as a taken username, retried with a generated username, fail again, and surface as an internal error.

The API maps `ErrEmailTaken` to `AlreadyExists` with the message "email is already in use". A read-before-write check is not relied on for correctness; the index is the guarantee and the classifier handles the race.

### API and UI

The proto field `User.email` keeps its name and type. Its comment states that the value is stored lowercased, that empty means no address, and that an address belongs to at most one user on the instance. No new RPC or field is added.

The web app changes in one place: the account settings form shows the `AlreadyExists` message inline on the email field. The signup form still collects no address.

### Security invariants

- Uniqueness is enforced by the database index on every driver, never only by an application check.
- No path links an existing account to a new identity, session, or credential because of a matching address.
- The canonical-form function is the only code that decides whether two strings are the same address; drivers never apply their own case folding.
- The `email` column never holds `''`. Empty and `NULL` mean the same thing at the store boundary, and only `NULL` reaches the table.
- The migration never merges, deletes, or reassigns accounts. It only clears the address on the losing rows.

### Testing

- Store tests on all three drivers through the existing testcontainers harness: canonical-form round trip, `NULL` mapping, duplicate insert returns `ErrEmailTaken`, concurrent inserts of the same address yield exactly one success, `FindUser.Email` with mixed case hits.
- A migration test on all three drivers that seeds the pre-0.31 legacy schema fixture with mixed-case and non-ASCII duplicates, surrounding whitespace, `''`, a display-name form, interior whitespace, and a value without `@`, migrates, and asserts the survivor rule, the `NULL` conversion, case-folded lookup, the index, id continuity across the SQLite rebuild, and that re-running the migrator is a no-op.
- API tests: signup, admin create, update, and `validate_only` reject malformed addresses with `InvalidArgument` and duplicates with `AlreadyExists`; SSO first login with a colliding address creates the account with no address and does not link.
- Unit tests for the canonical-form function covering display-name forms, whitespace, length, and case.

## Alternatives considered

| Alternative | Decision |
| --- | --- |
| Keep `NOT NULL DEFAULT ''` and add a partial unique index `WHERE email <> ''` | Rejected; MySQL has no partial indexes, and a generated-column substitute would give the three drivers different shapes for one rule. |
| Keep the user's casing and add a second `email_normalized` column for the index | Rejected; two columns to keep in sync for a cosmetic benefit no mainstream provider offers either. |
| Rely on the database collation for case-insensitive uniqueness | Rejected; behavior would differ per driver and per MySQL server configuration. Case folding belongs in one Go function. |
| Fail the migration when duplicates exist and make the operator fix them first | Rejected; a failed upgrade on a self-hosted install with no admin UI to fix data is worse than a logged, deterministic repair. |
| Keep the newest account's address instead of the oldest | Rejected; the oldest account is the most likely to be the one in use, and the rule must be deterministic either way. |
| Link an SSO identity to the account that already holds the reported address | Rejected; an unverified provider claim would become an account-takeover path. |
| Validate with `util.ValidateEmail` as it stands | Rejected; `mail.ParseAddress` alone accepts display-name forms, which would then be stored as the address. |
| Add a general pre- and post-migration hook system to the migrator | Rejected; one targeted pre-flight for this migration is enough, and a hook system would be speculative. |

## Deferred design

Email verification and a verified flag, sign-in by email, a change-of-address confirmation flow, internationalized domain normalization, plus-address awareness as an abuse signal, an admin view of accounts whose address was cleared by the migration, and any account linking by address remain deferred. Later work must preserve one-account-per-address, the single canonical-form function, and the rule that an address alone never grants access to an account.
