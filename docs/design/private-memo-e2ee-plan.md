# Private memo E2EE Implementation Plan

**Goal:** Implement optional encrypted private text memos with independent passphrase/recovery-key unlock.
**Architecture:** Store versioned ciphertext envelopes in memo payloads and wrapped vault keys in a dedicated table. Keep ordinary content empty for encrypted records. Enforce immutable encryption kind and restrictions at persistence/transport boundaries; decrypt only in ephemeral client state owned by MemoEditor.
**Tech Stack:** Existing Go/Connect/protobuf/SQL and React stack; Web Crypto AES-GCM, browser Argon2id.
**Spec:** [Private memo E2EE](private-memo-e2ee.md).

## Global Constraints

- New private, unassigned text memos only; no attachments, relations, comments, reactions, shares, remote previews or plaintext integrations.
- No plaintext keys or bodies in persistence, query caches, telemetry or requests.
- All three database drivers; generated protobuf outputs come only from buf.
- Existing auth/token behavior and ordinary memo behavior remain unchanged.
- Exact Argon2id profile: 64 MiB, 3 iterations, 4 lanes, 16-byte salt, 32-byte output; AES-256-GCM with 12-byte nonces and 128-bit tags.

## Review Focus

- Old-client content writes cannot remove encryption or publish ciphertext.
- Lock/account-switch during async operations cannot resurrect plaintext.
- Conflicting setup and revision writes fail atomically.
- Export/backfill and indirect attachment/relation writes cannot bypass restrictions.
- Recovery and changed passphrases preserve all saved notes across devices.

## Task 1: Protocol and persistence

Files: proto/api/memo_service.proto, proto/store/memo.proto, vault API messages; store/e2ee.go; existing store/db/{sqlite,mysql,postgres}/memo*.go; store/driver.go; all migration drivers.
Interfaces: versioned encrypted memo envelope; Get/Create/Update vault with compare-and-swap; encrypted payload and expected revision on UpdateMemo.
- [x] Write persistence tests for setup conflicts, wrapper CAS, immutable envelope identity, invalid metadata and stale revision writes; observe failure.
- [x] Implement dedicated vault table and driver methods, envelope persistence, transactional checks and migrations; regenerate proto.
- [x] Run targeted store/proto checks and record the tested unit.

## Task 2: API and integration restrictions

Files: store/e2ee.go, core/access/, server/api/memo_service*.go and vault handlers; store mutation policies; core/memopayload/; core/memoexport/; server/mcp/.
Interfaces: authenticated vault operations and memo envelope mapping, no unauthenticated routes.
- [x] Add tests for cross-user vault access, create/update conflicts, old-client overwrites, prohibited side effects and indirect mutations; observe failure.
- [x] Enforce encrypted memo restrictions in shared store validation and transport handlers. Suppress snippets, backfills, notifications, webhooks and exports.
- [x] Run server/core/store tests, inspect SQL restriction coverage and record results.

## Task 3: Client crypto and ephemeral vault session

Files: web/src/lib/e2ee/, web/src/contexts/E2EEContext.tsx, web/tests/e2ee*.test.ts.
Interfaces: createVault, unlockVault, recoverVault, changePassphrase, encryptMemo, decryptMemo; versioned typed records matching proto; a context exposes unlocked key only in memory.
- [x] Add real crypto round-trip, wrong-secret, tamper, AAD/context substitution, recovery, passphrase-change and session-race tests; observe failure.
- [x] Implement bounded protocol validation, fresh keys/nonces and canonical AAD; isolate Argon2id in a worker. Confirm recovery secret before persistence.
- [x] Implement manual/logout/account-switch/15-minute inactivity locks and stale async guards. Never persist plaintext drafts.
- [x] Run crypto/session tests, measure KDF and bundle impact, record results.

## Task 4: MemoEditor and account controls

Files: web/src/components/MemoEditor/, existing account settings/composer/cards, web/src/hooks/useMemoQueries.ts, locales and component tests.
Interfaces: MemoDraftSeed encryption selection; encrypted records remain ciphertext in React Query; decrypted text remains inside MemoEditor.
- [x] Add UI tests for locked placeholders, encrypted saves, restricted tools, no draft persistence, no remote resources, lock during save and ordinary editor regression; observe failure.
- [x] Add setup/unlock/recovery/passphrase-change controls and encrypted creation choice. Reuse MemoEditor with a restricted text surface and explicit error handling.
- [x] Translate every new key into every locale, run frontend lint/tests/build and record results.

## Task 5: Verification and documentation

- [x] Run go test -v -race ./server/... ./core/... and go test -v ./store/...; proto generation/lint; frontend lint/test/build.
- [x] Verify backup restore preserves vault identity and encrypted memos, canary plaintext never reaches persistence/network/integrations, and two-client round-trip.
- [x] Fresh reviewer inspects full diff for security/correctness, fix findings with regression tests.
- [x] Update design/README with actual behavior and limits.

## Implementation decisions and verification

- Ruling: Store encrypted envelope in the existing typed memo payload rather than add a second body column; SQL mutation checks must inspect the payload atomically. Dedicated vault storage still requires all-driver migrations.

- Task 1–4: implemented, reviewed and verified. Final commit is consolidated after cross-layer checks because the protobuf/store/client changes form one feature.
- Ruling: transaction-sensitive restrictions live in store/e2ee.go and driver mutation paths, with core/access and core/memopayload integrations. A duplicate core/e2ee validation package would weaken the atomic enforcement boundary.
- Ruling: MySQL uses explicit encryption cleanup to avoid prepared-statement reprepare failures with added cascades; SQLite also requires explicit cleanup because its configured connection disables foreign keys. PostgreSQL uses cascading constraints. Current/locking MySQL collection reads prevent deletion snapshot races.
- Review: resolved modal-dismissal and global-lock draft loss, protocol parser parity, MCP false-failure responses, deletion cleanup races and cross-driver retryable conflict mapping. Final scoped review found no outstanding findings.
- Verification: frontend lint and production build pass; Node 24 full suite passes 1,697 tests with the opt-in live-server test intentionally skipped. That live test ran separately against a fresh disposable instance and passed.
- Verification: browser creation, unlock, edit and lock passed; remote-image Markdown stayed inert. SQLite DB/WAL canary scan found no plaintext. Protocol golden vector and 1 MiB boundary checks pass.
- Environment note: the existing memo-editor-transcription test failed under host Node 26, also on an unchanged baseline snapshot; it passes under the CI Node 24 toolchain. No unrelated transcription code/test was changed.
- Backend evidence: server/core race suite, all three database suites, cross-driver concurrent-write tests, SQLite backup/restore and protobuf generation/lint/format. Final aggregate verification is recorded in the design's validation record.

## Follow-up: optional plaintext titles (2026-11-10)

- [x] Add compatible `encrypted_title` API/payload fields and regenerate; validate titles (256 Unicode characters, no controls), reject ordinary-memo usage, and preserve title when older clients update only the envelope.
- [x] Test API round trips, clearing, invalid titles, old-client preservation and stale title/body updates; verify store persistence across drivers.
- [x] Add optional labeled title input and plaintext notice; test saved title, title-only edits, locked title/fallback, inert title rendering and no plaintext body leakage.
- [x] Make creation action a normal-size neutral button with lock icon and spacing; translate new copy into all locales.
- [x] Run proto lint, server/core race tests, store tests, frontend lint/tests/build; review changes.

Review focus: legacy title omission; empty title clearing; conflict atomicity; literal rendering of markup-like titles; lock during unsaved title edits.


Follow-up verification: API/editor tests were observed failing before implementation, then passing. Server/core race suite,
all three store drivers, proto lint/format, frontend lint/build and the full Node 24 frontend suite passed (1,702 tests;
one opt-in live test skipped). The live test ran separately against a disposable instance and passed with plaintext title and
ciphertext-only body round trips. The prior transcription test showed an intermittent failure also reproduced on the
unchanged baseline; the final complete run passed.

Final review: independent reviewer found no blocking issues. Final: minor (deferred): HTML maxLength counts UTF-16 units,
so emoji-heavy titles hit the editor limit before the server's 256-code-point cap; this is a conservative input restriction.
Title/body conflict atomicity, legacy omission, explicit empty clearing, inert title rendering and title-only dirty handling
are covered. Browser inspection confirmed existing locked records use the icon/default-title display.

## Follow-up: passkey unlock (2026-11-10)

Goal: optional WebAuthn PRF local vault unlock; login and existing secrets unchanged. User approved this approach and implementation.
- [x] Backend: List/Create/DeleteEncryptionPasskey RPCs, bounded strict wrapper validation, owner-only table and all-driver migrations, transactional cap/ownership and deletion cleanup. Tests: authentication/isolation, invalid records, duplicate/cap, deletion, passphrase preservation.
- [x] Browser: local PRF registration/unlock, HKDF/AES-GCM key wrapping, exact validation and capability fallback. Tests: cryptographic round trip, wrong PRF/tampering, required UV, RP filtering, cancellation and malformed outputs.
- [x] UI: unlocked registration/removal and locked passkey unlock alongside password/recovery; stale session/unmount guard, localized guidance and errors. Tests: no secret API transmission, cancellation fallback, cross-account results ignored.
- [x] Verification: proto generation/lint, server/core race/store tests, frontend lint/test/build, fresh independent security review.

Review focus: PRF never serialized into requests; RP/vault/credential substitution; unsupported authenticators; stale async operations;
older-client compatibility and account-deletion races. Real passkey registration requires the user's device prompt; automated tests
use fake WebAuthn responses plus real Web Crypto and do not claim hardware verification.


Verification: frontend lint/build passed; full Node 24 suite passed 1,715 tests with one opt-in live test skipped.
The separate live test passed, exercising real client HKDF/AES-GCM wrappers against server CRUD and decrypting the memo
with the retrieved wrapper. PRF bytes in that live test are synthetic, not an attestation of hardware/browser support.
Server/core race tests and the full store suite passed across SQLite, MySQL, PostgreSQL. Incremental migration,
SQLite backup restore, cap races and account deletion races passed; repeated driver-specific race tests passed.
Proto generation/lint/format and scoped go fix -diff passed.

Independent review found one substantive enrollment risk: discoverable credentials could replace existing credentials.
Fixed after a failing regression test: supply excludeCredentials plus a fresh random per-enrollment user handle, so stale
lists and concurrent abandoned enrollments cannot replace a working credential. Also aligned lowercase RP validation.
An additional failing regression showed abandoned password input surviving passkey unlock; accepting a key now clears it.
No unresolved review findings remain for this follow-up. Physical device/PRF interoperability remains user-device validation;
unsupported environments keep password/recovery available. Existing login and tokens are unchanged.
