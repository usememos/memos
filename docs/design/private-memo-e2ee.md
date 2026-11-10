# Private text memo E2EE

Status: Draft — scope agreed; detailed design pending review and approval.

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
IDs, owner, timestamps, state, pinned status, ciphertext length, and access patterns remain visible to the server.

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
- Authenticate a canonical, length-delimited context: protocol version, purpose (`body`, `data-key`, or vault wrapper type), immutable vault ID,
  immutable encrypted-object ID, and revision ID where applicable. Never use mutable usernames as cryptographic identity.
- The client generates encrypted-object and revision IDs before create. The server enforces object-ID uniqueness within a vault and immutability
  of object/vault identity on update. Bind the body and wrapped data key to the same revision. Define exact encodings and golden vectors before code.

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

The envelope contains protocol/version IDs, key ID, object/revision IDs, body ciphertext/tag/nonce, and wrapped data key/tag/nonce.
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
This document is a proposal, not evidence of an implemented or independently audited E2EE feature.
