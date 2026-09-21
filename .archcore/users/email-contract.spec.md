---
title: "Email normalization and persistence"
status: draft
tags:
  - "users"
---

## Purpose & Scope
Status: Accepted (2026-09-12).
This spec defines how a user's optional email address is canonicalized, stored, looked up, migrated, and reported on conflict. It is normative for the canonical-form function (@store/email.go), the store user boundary (@store/user.go, @store/user_unique.go), the three driver schemas under @store/migration, and the user write paths in @server/api/v1/user_service.go and @server/api/v1/auth_service_sso.go. API clients, the web account settings form, and SSO provisioning depend on it.
Out of scope: verification, ownership proof, sign-in by email, SSO account linking by address, plus-address or dot folding, internationalized domain normalization beyond lowercasing, and signup rate limiting or enumeration resistance.

## Surface
- `store.NormalizeEmail(email) (string, error)` — the canonical-form function (@store/email.go).
- `store.User.Email` stays a Go `string`; `FindUser.Email` is the lookup field (@store/user.go).
- Column `user.email`, nullable, with `UNIQUE INDEX idx_user_email ON user(email)` in each `LATEST.sql`: SQLite `TEXT COLLATE BINARY DEFAULT NULL`, MySQL `VARCHAR(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL`, PostgreSQL `TEXT COLLATE "C" DEFAULT NULL` (@store/migration/sqlite/LATEST.sql, @store/migration/mysql/LATEST.sql, @store/migration/postgres/LATEST.sql).
- Migration `0.31/07__unique_email.sql` per driver (@store/migration/sqlite/0.31/07__unique_email.sql) and its Go pre-flight (@store/migrator_email.go).
- Sentinels `store.ErrEmailTaken`, `store.ErrUsernameTaken`, `store.ErrUserIdentityTaken` and the unique-violation classifier (@store/user_unique.go).
- Proto field `User.email` (@proto/api/v1/user_service.proto): name and type unchanged; its comment states that the value is stored lowercased, empty means no address, and an address belongs to at most one user. No new RPC or field.

## Normative Behavior
Canonical form
1. The canonical-form function MUST trim surrounding whitespace before any other step.
2. WHEN the trimmed value is empty, the function MUST treat it as no address and skip the remaining steps.
3. IF the trimmed value is longer than 254 bytes, THEN the function MUST reject it.
4. IF `net/mail.ParseAddress` fails on the value, THEN the function MUST reject it.
5. IF the parsed address differs from the input, THEN the function MUST reject it, which excludes display-name forms such as `Alice <alice@example.com>`.
6. The function MUST lowercase the whole string, local part and domain alike.
7. The function MUST NOT require the domain to contain a dot.

Persistence and lookup
8. The store MUST persist only the canonical value; the original casing is not kept.
9. WHEN writing, the driver boundary MUST map `""` to `NULL`.
10. WHEN reading, the driver boundary MUST map `NULL` to `""`, so callers never see `NULL`.
11. WHEN `FindUser.Email` is set, the store MUST trim and lowercase it before querying.
12. WHEN the trimmed lookup value is empty, the store MUST return no users.

Write paths
13. Every API write MUST pass the address through the canonical-form function and return `InvalidArgument` with the reason on rejection.
14. The store MUST canonicalize the address again before writing, since tests and the seed path reach store methods directly.
15. `CreateUser` MUST apply these checks to first-user bootstrap, admin creation, and self-service signup.
16. WHEN `validate_only` is set, `CreateUser` MUST perform the same checks without writing.
17. WHEN `UpdateUser` carries `email` in the update mask with an empty string, the service MUST clear the address.
18. WHEN SSO first login creates a user, `createSSOUser` MUST canonicalize the address mapped from the identity provider.
19. The store MUST classify a driver unique violation by the constraint text after the driver's marker, never by the duplicate value.
20. The SSO retry loop MUST retry only on `ErrUsernameTaken`, reconcile only on `ErrUserIdentityTaken`, and drop the address only on `ErrEmailTaken`.
21. WHEN the store returns `ErrEmailTaken`, the API MUST return `AlreadyExists` with the message `email is already in use`.
22. WHEN an email update returns `AlreadyExists`, the account settings form MUST show the message inline on the email field.
23. The signup form MUST NOT collect an email address.

Migration
24. The migration MUST create `idx_user_email` as its last statement.
25. The repair MUST first set each value to `LOWER(TRIM(email))`.
26. The repair MUST clear values with no `@` and values containing `<`, `>`, or an interior space.
27. WHEN several rows hold one canonical value, the repair MUST keep it on the row with the lowest `id` and clear every other row.
28. The repair MUST convert `''` to `NULL`.
29. On SQLite, the migration MUST repair the old table, then rebuild `user` with `NULLIF(email, '')` and carry the `sqlite_sequence` entry across.
30. On MySQL, the migration MUST switch the column to `utf8mb4_bin` and nullable before the repair.
31. On PostgreSQL, the migration MUST alter the column, then repair, inside the migration transaction.
32. The migration MUST guard index creation with `IF NOT EXISTS` on SQLite and PostgreSQL and a prepared-statement check on MySQL.
33. WHEN the stored schema version is below this migration's version, the migrator MUST run the Go pre-flight before the SQL file.
34. The pre-flight MUST rewrite each non-empty value that differs from its Unicode-lowercased, trimmed form, reading rows ordered by id.
35. The pre-flight MUST log one warning per duplicate group naming the keeping username and the cleared usernames.
36. The pre-flight MUST log one line listing users whose value will be cleared as malformed.
37. The pre-flight MUST NOT log email addresses.
38. A fresh install MUST take the final schema from `LATEST.sql` and never run the repair.

## Constraints & Invariants
- Constraint: stored addresses MUST NOT exceed 254 bytes (the practical forward-path limit noted in @store/email.go).
- Invariant: the `email` column never holds `''`; empty and `NULL` mean the same at the store boundary, and only `NULL` reaches the table.
- Invariant: uniqueness is enforced by the database index on every driver, never only by an application check; a read-before-write check is not relied on for correctness.
- Invariant: the canonical-form function is the only code that decides whether two strings are the same address; drivers apply no case folding of their own.
- Invariant: no path links an existing account to a new identity, session, or credential because of a matching address.
- Invariant: the migration never merges, deletes, or reassigns accounts; it only clears the address on losing rows.
- Invariant: every later migration tolerates the store test suite rewinding the schema version on a fresh install.

## Failure Behavior
1. IF the SSO-mapped address is malformed, THEN `createSSOUser` MUST create the account with no address and log a warning naming the provider and external identifier.
2. IF another account already holds the SSO-mapped address, THEN `createSSOUser` MUST create the account with no address and log the same warning.
3. IF another account already holds the SSO-mapped address, THEN `createSSOUser` MUST NOT link the identity to that holder.
4. IF a concurrent insert wins the address, THEN the classifier MUST return `ErrEmailTaken` for the rejected second write.
5. IF a pre-flight step fails, THEN the migrator MUST log the failure and continue the migration.
6. WHEN the migration file runs against a database that already carries the index, the file MUST complete as a no-op.
7. IF a legacy malformed value survives the SQL repair (for example an oversized one), THEN the API MUST reject it at the user's next edit of the field.
8. WHEN the migration clears an address, the store MUST keep no copy of the cleared value; the operator log is the only record.
9. WHEN the migration cleared a user's address, the user MAY set an address again from the profile page.

## Conformance
An implementation is conformant when it satisfies behaviors 1–38, holds every invariant, and follows the failure rules. Evidence lives in store tests on all three drivers (@store/test/user_email_test.go), the legacy-schema migration test (@store/test/migrator_unique_email_test.go) covering the survivor rule, `NULL` conversion, case-folded lookup, the index, SQLite id continuity, and a no-op re-run, API tests (@server/api/v1/test/user_service_unique_email_test.go), and the classifier unit test (@store/user_unique_test.go).
Given accounts 3 and 7 both store `Alice@Example.com` before 0.31,
When the migration runs,
Then account 3 holds `alice@example.com`, account 7 holds `NULL`, and one warning names both usernames.
