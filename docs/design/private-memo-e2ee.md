# Private text memo E2EE

Status: Draft — implemented on the contribution branch; not shipped in a tagged release.

Date: 2026-11-10

## Intent and agreed scope

Offer optional end-to-end encryption for newly created, author-only PRIVATE text memos. Keep ordinary memos unchanged.
Encryption and decryption occur on the user's client. The server stores ciphertext and cannot recover the content from its stored keys.
The user approved a separate encryption passphrase plus a recovery key; login credentials remain independent.

V1 excludes attachments, image uploads, drawings, audio input, comments, share links, Space placement, public/protected audiences,
and conversion between existing plaintext memos and encrypted memos. Both API validation and UI enforce these restrictions.
No new authentication/token behavior, release workflow, or dependency installation is included in this design-only change.

## Approaches

1. **Optional private text memos (selected).** A bounded addition that preserves ordinary workflows and avoids shared-key distribution.
2. **Encrypt all memos.** Disrupts public content and server-derived features; rejected for the initial contribution.
3. **Encrypted shared Spaces.** Requires member key distribution, membership changes, and a separate revocation model; deferred.

The remaining technical choices below are proposals by the author, not additional user requirements.

## Current implementation and affected boundaries

- `proto/api/memo_service.proto` requires `content`; `store/memo.go` stores plaintext content and derived payload.
- `server/api/memo_service.go` and `memo_create_helpers.go` derive payload when content changes.
- `core/memopayload/runner.go` reprocesses stored content during payload backfill; it must also skip encrypted records.
- `server/api/memo_service_converter.go` creates snippets and projects metadata, including relation snippets.
- Webhook and mention handlers consume memo content. All content-bearing integrations need an explicit encrypted-record policy.
- `web/src/hooks/useMemoQueries.ts` shares memo records across queries. Keep these records encrypted.
- `web/src/components/MemoEditor/` owns display, editing and saves; its `useAutoSave` persists plaintext drafts today.

## Security boundary

Protect body text and its derived content against database, storage and backup disclosure, assuming a trusted client and a sufficiently strong
passphrase. Preserve existing authorization as well: possession of ciphertext is not a reason to widen access.
IDs, owner, timestamps, state, pinned status, ciphertext length, access patterns, and the optional user-entered title remain visible to the server.

This does not protect against malicious client code served by a compromised server, XSS, browser extensions with access, an infected device,
or capture while unlocked. It does not provide cryptographic rollback detection or deletion from old backups.
Passphrase guessing remains possible against a stolen wrapped-key record; the KDF raises its cost.
JavaScript cleanup removes references on lock but cannot promise physical memory zeroization.

## Keys and cryptographic protocol

Use a versioned protocol with established primitives, no bespoke cryptography. Proposed profile:

- Generate a random 256-bit user vault key on the client. It never leaves the client unwrapped.
- Derive a wrapping key from the separate passphrase using Argon2id with a random salt. Benchmark the RFC 9106 memory-constrained profile
  (64 MiB, 3 iterations, 4 lanes, 128-bit salt, 256-bit output) on supported browsers before freezing the protocol.
  Store the profile/version and salt; accept only bounded, supported parameters before executing the KDF.
- Generate a separate random 256-bit recovery secret, display it in a copyable encoding with error detection, and require confirmation before setup
  completes. Independently wrap the same vault key using that secret. Never send or persist the recovery secret or passphrase in plaintext.
- Generate a fresh 256-bit data key for each saved content revision. Encrypt UTF-8 Markdown with AES-256-GCM, a fresh random 96-bit nonce and
  a 128-bit authentication tag. Wrap the data key under the vault key using a separate AES-GCM operation and fresh nonce.
- Authenticate a canonical JSON-array context: protocol version, purpose (`body`, `data-key`, or vault wrapper type), immutable vault ID,
  immutable encrypted-object ID, and revision ID where applicable. Never use mutable usernames as cryptographic identity.
- The client generates encrypted-object and revision IDs before create. The server enforces object-ID uniqueness within a vault and immutability
  of object/vault identity on update. Bind the body and wrapped data key to the same revision. The exact AAD is UTF-8 JSON `["memos-e2ee",1,purpose,vaultId,objectId,revisionId]`; absent object/revision IDs are empty strings.

Sources: [RFC 9106](https://www.rfc-editor.org/rfc/rfc9106.html) for Argon2id and
[W3C Web Cryptography](https://www.w3.org/TR/webcrypto/) for AES-GCM and authenticated additional data.
Selecting and reviewing the browser Argon2 implementation, bundle cost, and worker support is an implementation prerequisite;
ask before introducing a heavy dependency. Do not silently downgrade the KDF when a browser cannot run the selected profile.

## Setup, unlock, recovery and key lifecycle

Setup creates one vault per account atomically after recovery-secret confirmation; concurrent setup attempts cannot replace an existing vault.
Authenticated clients fetch only their wrapped-key record. Unlock happens locally; login by itself does not unlock memos.
A new device signs in and unlocks with the encryption passphrase or recovery secret.

Changing the encryption passphrase rewraps the existing vault key with a fresh salt and nonce. Recovery locally unwraps that key and permits
setting a new encryption passphrase. Wrapper updates use compare-and-swap to prevent concurrent changes losing access.
An account password reset leaves the vault unchanged. Losing both encryption passphrase and recovery secret loses access permanently.
Do not provide an administrator recovery key or silently recreate an inaccessible vault.

V1 retains the original recovery secret; recovery-secret rotation and vault-key rotation are deferred. Changing a passphrase does not revoke
a device that already has the vault key, or protect old wrapper backups from someone who knows the old passphrase.

## API and persistence

Add an explicit encrypted envelope alongside the existing content field, preserving existing field numbers and plaintext behavior.
For an encrypted memo, `content` is empty and the envelope is required; plaintext and ciphertext cannot be submitted together.
Adjust the content-required API annotation/validation to express this conditional requirement without moving existing fields into a oneof.
Unknown envelope versions fail closed. Generated clients lacking E2EE support receive no readable body and cannot overwrite encrypted bodies
through legacy content writes. Encryption kind is immutable in V1.

The envelope contains protocol version, vault/object/revision IDs, body ciphertext/tag/nonce, and wrapped data key/tag/nonce.
Store vault wrappers separately from ordinary user settings so list-users, admin settings, exports, logs and telemetry cannot expose them accidentally.
Never return wrappers through public routes. Do not add E2EE endpoints to the unauthenticated ACL list.

Content writes require the expected revision ID; conflicts preserve the local edit and require refetch/reconciliation. Reject stale writes rather than
silently overwriting ciphertext. Apply envelope shape/size checks and bounded quotas server-side; the server cannot validate plaintext length.
Use a documented ciphertext byte cap, accounting for encryption overhead, without trusting client-reported plaintext sizes.

Add migrations and fresh-install equivalents for SQLite, MySQL and PostgreSQL. Update proto sources and regenerate all outputs with `buf generate`.
Centralize encryption restrictions in `core/` and enforce them from every write transport, including MCP and import paths.

## Restricted features and metadata

Encrypted memos must remain PRIVATE, unassigned, top-level, attachment-free, and without relations or location data.
Reject adding relations, comments, reactions, attachments, shares or placement to encrypted memos, including reverse references from ordinary memos.
Derived tags, properties, snippets and previews stay empty. Backfills must never parse ciphertext as Markdown.
Disable server content search and tag filters for these memos; ordinary date/state browsing remains available. No local full-text index in V1.

Suppress encrypted-memo webhooks, mention/email notifications, AI suggestions and server link previews entirely in V1.
SSE may signal only a resource identity change. Audit feeds, statistics, MCP and public projections for content-derived fields.
Counts may reveal the existence of encrypted memos; this is part of the declared metadata boundary.

Existing export/import must explicitly reject selections containing encrypted memos with an actionable error, rather than silently omit them or
export empty bodies. Full server backups must preserve ciphertext and vault records together; test restore under the same immutable vault IDs.
A portable encrypted export format and plaintext download are deferred. Warn of this V1 limitation before enabling the vault.

## Client behavior

Add an explicit encrypted-memo creation choice after vault setup. The default composer remains unchanged; encrypted mode is fixed for the session.
Show locked placeholders without decrypted snippets. Keep ciphertext in React Query and plaintext only in a separate ephemeral editor/view state.
Encrypt before any mutation enters the network layer; never place plaintext in mutation variables, error reports or debugging logs.

V1 disables persistent drafts for encrypted memos. Warn before leaving unsaved work; do not reuse ordinary localStorage draft handling.
On explicit lock, logout, account switch or reload, discard decrypted state, editor history and keys, invalidate asynchronous decryption results,
and revoke related object URLs. A proposed 15-minute inactivity lock warns about unsaved edits before discarding them; cross-tab lock signals
carry no secret data. Each tab must unlock independently. Pending saves already encrypted may complete but must not repopulate plaintext after lock.

Text may contain Markdown syntax, but encrypted views must not load remote images, embeds, link cards or other automatic network resources.
Render image/embed syntax inertly; ordinary links require an explicit click. Exclude attachment paste/drop and audio/drawing commands.
Reuse `MemoEditor`, design-system controls, field validation and translated strings. No separate editor implementation.

## Verification and contribution sequence

1. Discuss this scope and the conditional-content API compatibility with upstream maintainers before a large implementation PR.
2. Freeze cryptographic serialization, selected browser KDF, resource limits and golden vectors after compatibility measurements and review.
3. Implement schema/API and core restrictions, then setup/unlock/recovery and editor integration. Keep incomplete support unavailable to users.
4. Verify create/read/edit/delete, two-device unlock, recovery, passphrase changes, conflicts, lock races and full backup restore.
5. Add tamper/wrong-key/AAD tests, cross-user authorization tests, legacy-client write rejection and all three database driver tests.
6. Use canary text to verify no plaintext reaches requests, DB rows, logs, drafts, webhooks, AI, notifications or exports. Test remote Markdown
   resources make no automatic request and ordinary memo behavior remains unchanged.
7. Run `go test -v -race ./server/... ./core/...`, `go test -v ./store/...`, `cd proto && buf generate && buf lint`, and
   `cd web && pnpm lint && pnpm test && pnpm build`. Review API compatibility and generated diffs.

Security review is a release prerequisite; unit tests alone do not establish the cryptographic protocol's security.
This implementation has local tests and code review; it has not received an independent cryptographic security audit.

## Implementation notes (2026-11-10)

- API messages carry protocol JSON as `encrypted_content` bytes and vault records as `vault` bytes. Strict validation rejects unknown,
  duplicate, incorrectly cased keys, non-v4 UUIDs, noncanonical base64 and oversized values. The encrypted memo payload is separate from plaintext content.
- `encryption_vault` stores one wrapped-key record per owner. `memo_encryption` enforces object uniqueness and revision CAS in the same SQL
  transaction as each memo write. Both tables ship in the three drivers' `26.11/00` migrations and `LATEST.sql`.
- Protocol v1 fixes the Argon2id profile above. `hash-wasm` 4.12.0 provides it in a Web Worker (approximately 28 kB minified worker in the local
  production build). AES-GCM uses Web Crypto. Recovery keys contain a 32-byte random secret and a four-byte SHA-256 checksum, encoded as hex.
- The client requires HTTPS (or localhost), Web Crypto, Web Workers and WebAssembly. Encryption controls live in account settings and the new-memo composer. Existing encrypted memos render and edit through the restricted text
  mode inside MemoEditor: all Markdown is inert text, including links. No separate rich-text runtime or persistent draft is mounted.
- Explicit lock and modal dismissal check the shared dirty-editor registry. Route/unload navigation warns before losing unsaved text.
  Inactivity, logout, account changes and received cross-tab lock signals force locking. Each tab unlocks independently.
- MCP responses redact encrypted bodies; successful metadata-only changes remain successful. Content filters exclude encrypted records,
  including negative content/tag/property predicates. Plaintext exports reject a user selection containing encrypted memos before writing output.
- No login or token behavior changed. Existing plaintext memos cannot be converted, and encrypted memos cannot be converted back in V1.

### Reproducible live smoke check

Against a fresh disposable localhost instance only (the test creates a user, vault and memo):

```bash
go run -buildvcs=true ./cmd/memos --port 18081 --data /tmp/memos-e2ee-smoke
# In another terminal:
cd web && E2EE_SMOKE_URL=http://localhost:18081 pnpm test tests/e2ee-live.test.ts
```

The opt-in test exercises real browser-compatible encryption, authenticated RPC persistence, a second client unlock and revision updates.
It is skipped in the normal frontend suite because it requires that separate disposable server. No production credentials or data are used.

### Validation record

Verified locally on 2026-11-10 using Go 1.27.3, Node 24.22.2, pnpm 11.25.0 and Buf 1.75.0:

- `go test -v -race ./server/... ./core/...`: passed.
- `go test -v ./store/...`: passed, including SQLite, MySQL and PostgreSQL TestContainers runs.
- Cross-driver concurrent encrypted mutation regressions with `-race`: passed, with exactly one successful revision and one conflict.
- SQLite backup/restore and account/memo encryption cleanup tests: passed. MySQL's deterministic concurrent-create/delete regression passed.
- `cd proto && buf generate && buf lint` and `buf format --diff --exit-code`: passed.
- `cd web && pnpm lint && pnpm test && pnpm build` with Node 24 first in PATH: passed; 1,697 frontend tests, one intentionally skipped live-server test.
- The opt-in live-server test passed separately. Browser smoke verified create, edit, lock and unlock with real Web Crypto and the Argon2 worker.
- Tests cover malformed records, authentication failures, fixed interoperability vectors, maximum body size, recovery, passphrase changes,
  plaintext-free save requests, inactive drafts, modal close guards and late save completion after identity changes.
- Production build retains chunk-size/plugin-timing warnings. Host Node 26 exposes an existing audio-transcription test failure also reproduced
  on the unchanged baseline; the CI Node 24 suite is green.

These checks do not replace an independent cryptographic security audit or exhaustive browser/device compatibility testing.

## Optional plaintext title and creation affordance

User-approved scope (2026-11-10): an optional plaintext title distinguishes locked memos. Never extract it from the body.
Use `encrypted_title` on the API and existing typed JSON payload, with no SQL schema change. Empty means no title;
show the translated “Encrypted memo” fallback. Titles are at most 256 Unicode characters, with no control characters.
The input explicitly states that titles are not encrypted. Titles are neither encrypted nor cryptographically authenticated.
They remain author-only under the existing read policy and are not added to search, snippets, exports or integrations.
Updates include a fresh encrypted envelope and expected revision so title/body saves are atomic; old clients that omit the
new update-mask path preserve the title. Ordinary memos cannot use this field.

Locked memo content displays a lock icon and the title as one accessible button; clicking opens the existing unlock panel.
Unlocked viewing also displays the title, while editing offers an optional title input. Body text and drafts remain ephemeral.
The new encrypted memo action is a bordered, normal-size button with a lock icon above the ordinary composer, including
hosted creation. Space/comment creation still excludes it.
