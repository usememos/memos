---
title: "Unique email identity"
status: draft
tags:
  - "users"
---

## Context
Status: Accepted (2026-09-12).
An optional email field without canonicalization or uniqueness cannot identify at most one account for future verification, reset, receipts, or abuse signals. The decision separates unique address storage from proof of ownership; @store/email.go contains normalization and @store/migration/sqlite/0.31/07__unique_email.sql records the schema transition. It preserves the API string representation and does not authorize sign-in or account linking by address.

## Decision
Store optional email as a Unicode-lowercased canonical value or database NULL, with an instance-wide unique index on all three drivers and deterministic repair of legacy duplicates.

## Decision Details
Normalization trims surrounding whitespace, treats empty as absent, rejects values exceeding 254 bytes, requires `net/mail.ParseAddress` to return the exact bare input address, then lowercases both local part and domain (@store/email.go).
No provider-specific plus/dot folding or additional dot-in-domain requirement applies. Original display casing is deliberately lost; internationalized-domain normalization beyond lowercasing is deferred.
Database NULL represents absence; the Go/API boundary continues using the empty string. `idx_user_email` enforces uniqueness, with SQLite `BINARY`, MySQL `utf8mb4_bin`, and PostgreSQL `C` collations in the three `LATEST.sql` schemas.
Lookup trims/lowercases the query and treats an empty lookup as no match. API writes validate and store writes normalize defensively; correctness rests on the unique index rather than a preflight lookup.
Repair retains the lowest-ID account's canonical address and clears competing addresses without merging, deleting, or reassigning accounts. Fresh installs use the final schema directly.
SQL repair clears values without `@` or containing angle brackets/interior spaces; other malformed values can remain until edited. Unicode case folding needs the targeted Go preflight because portable SQL lowercase is insufficient (@store/migrator_email.go).
The preflight logs affected usernames, never addresses, and logs failures without blocking migration. Cleared values have no separate recovery store; users can set an address again.
SQLite rebuilds the user table while preserving ID continuity; MySQL changes to binary collation before deduplication and can partially commit DDL; PostgreSQL repairs within its migration transaction. Index creation follows repair; repeat migration tolerates the already-present schema.
Self-service/admin/bootstrap creation, validation-only creation, profile updates, and SSO writes participate. Empty profile email clears the address.
Malformed or colliding SSO email produces an account without that email, plus a provider/external-ID warning; it never links to the current holder.
Typed email, username, and identity collision errors distinguish the SSO retry/reconcile/drop-email branches; parsing examines constraint-marker suffixes rather than duplicate values.
Email conflicts return `AlreadyExists` with `email is already in use`; malformed addresses return `InvalidArgument`. Account settings show the conflict inline; signup still collects no email.

## Alternatives Considered
- **Non-null empty string plus partial index:** rejected because MySQL lacks partial indexes and a generated-column substitute would diverge across drivers.
- **Display and normalized columns:** rejected because casing alone does not justify keeping two columns synchronized.
- **Database-default case folding:** rejected because drivers and MySQL defaults differ; one Go normalizer fixes comparison semantics.
- **Abort upgrade on duplicates:** rejected because deterministic logged repair avoids leaving self-hosted installs without an administrative repair UI.
- **Newest-row survivor:** rejected because the oldest account is judged more likely to remain in use; lowest ID also supplies determinism.
- **SSO linking by matching email:** rejected because an unverified provider claim can grant access to another account.
- **Bare `mail.ParseAddress` validation:** rejected because it admits display-name forms rather than only bare addresses.
- **General migration hook framework:** rejected because the single targeted preflight satisfies this migration without a broader mechanism.

## Consequences
### Positive
- The database permits multiple absent addresses but at most one stored canonical non-empty address.
- Wire fields retain their names/types; account identity is never inferred solely from email equality.
- The repair rule identifies one survivor without changing user ownership.
### Tradeoffs
- Original casing and cleared duplicate values are lost; the operator log is the only repair record.
- MySQL migration DDL is not atomic, and legacy validation remains less complete than write-time validation.
- Uniqueness does not establish ownership or provide enumeration resistance.

## Deferred Work
Verification/verified flags, email sign-in, change-address confirmation, broader domain normalization, plus-address abuse signals, repair administration, and address-based account linking remain deferred.
