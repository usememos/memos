# Private memo E2EE Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for backend/localization work and inline implementation for the client. Track verification below.

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
- [x] Update design/README with actual behavior and limits; leave branch local without publishing.

## Execution ledger

- 2026-11-10: User approved design and requested implementation. Execute directly on the existing clean codex/e2ee feature branch; no additional approval handoff.
- Ruling: Store encrypted envelope in the existing typed memo payload rather than add a second body column; SQL mutation checks must inspect the payload atomically. Dedicated vault storage still requires all-driver migrations.

- Task 1–4: implemented, reviewed and verified. Final commit is consolidated after cross-layer checks because the protobuf/store/client changes form one feature.
- Ruling: transaction-sensitive restrictions live in store/e2ee.go and driver mutation paths, with core/access and core/memopayload integrations. A duplicate core/e2ee validation package would weaken the atomic enforcement boundary.
- Ruling: MySQL uses explicit encryption cleanup to avoid prepared-statement reprepare failures with added cascades; SQLite also requires explicit cleanup because its configured connection disables foreign keys. PostgreSQL uses cascading constraints. Current/locking MySQL collection reads prevent deletion snapshot races.
- Review: resolved modal-dismissal and global-lock draft loss, protocol parser parity, MCP false-failure responses, deletion cleanup races and cross-driver retryable conflict mapping. Final scoped review found no outstanding findings.
- Verification: frontend lint and production build pass; Node 24 full suite passes 1,697 tests with the opt-in live-server test intentionally skipped. That live test ran separately against a fresh disposable instance and passed.
- Verification: browser creation, unlock, edit and lock passed; remote-image Markdown stayed inert. SQLite DB/WAL canary scan found no plaintext. Protocol golden vector and 1 MiB boundary checks pass.
- Environment note: the existing memo-editor-transcription test failed under host Node 26, also on an unchanged baseline snapshot; it passes under the CI Node 24 toolchain. No unrelated transcription code/test was changed.
- Backend evidence: server/core race suite, all three database suites, cross-driver concurrent-write tests, SQLite backup/restore and protobuf generation/lint/format. Final aggregate verification is recorded in the design's validation record.
