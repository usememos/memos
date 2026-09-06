# Bookmarks release evidence

Implementation is in progress on `codex/bookmarks-production-readiness`. This file distinguishes completed checks from remaining release gates. Earlier audit evidence is in [the audit](bookmarks-production-readiness.md); it does not validate later changes automatically.

## Database qualification

2026-09-06: the focused SQLite race suite passed after extending the snapshot regression with accented/trailing-space content and two simultaneous maintenance writers. Exactly one writer publishes, and the loser receives the stale-snapshot sentinel.

```bash
rtk proxy env DRIVER=sqlite GOMAXPROCS=2 GOCACHE=/private/tmp/memos-bookmarks-go-cache go test -p 2 -count=1 -v -race ./store/test -run '^TestMemoPayload'
```

Result: PASS, 10.901 seconds. The initial sandboxed attempt could not bind the test setup's ephemeral localhost port; rerunning with local test execution permission passed. Go is 1.27.1 on this host. Final whole-surface suites must be rerun after implementation.

The same concurrent-writer case with `DRIVER=mysql` and `DRIVER=postgres` returned **SKIP**, explicitly reporting Docker not running/rootless provider unavailable. No Docker, OrbStack, Colima, mysql or psql executable/runtime was found in the checked standard locations. A process exit code of zero from these skipped tests is not database qualification.

Required on a Docker-capable test host:

```bash
rtk proxy env DRIVER=mysql go test -count=1 -v -race ./store/...
rtk proxy env DRIVER=postgres go test -count=1 -v -race ./store/...
```

Existing TestContainers configuration targets MySQL 8.4 and PostgreSQL 18. No workflow or container configuration was changed.

## Verified implementation snapshot

2026-09-06, before the requested commit and push:

- `DRIVER=sqlite GOMAXPROCS=2 GOCACHE=/private/tmp/memos-bookmarks-go-cache go test -p 2 -race ./store/... ./internal/... ./server/...`: PASS. Store integration tests ran in 173.397 seconds; API integration tests in 96.462 seconds. MySQL/PostgreSQL driver package compilation is not real-engine qualification.
- Local and in-process S3 filename-only-template tests preserve the shared old object's bytes and key after successful repair, attachment creation failure, memo CAS conflict and simultaneous candidate uploads.
- Fresh metadata bypasses both a seeded successful cache and a concurrent ordinary metadata flight. Refresh also rediscovers expired image URLs when no cached cover UID exists.
- Complete static-image validation distinguishes actual PNG animation chunks from harmless metadata marker text and rejects excessive dimensions and pixel counts.
- Cursor tests exercise exclusive ID ordering, fixed upper bounds, inserts/deletes between pages and rejection of changed caller/state/filter/page-size/operation tokens.
- Memo-cover route tests cover owner/public/Space/share access, revocation, standalone privacy, Local/S3 delivery, thumbnails, range responses and Local conditional responses with final `private, no-store` headers.
- Frontend full suite: 153 files / 1,211 tests passed. After the final safe-log and already-aborted parser guard edits, lint, 27 affected tests and production build passed again. The build retains existing large-chunk warnings.
- Near-10-MiB CSV fixtures measured 289.64–612.57 ms synchronous parsing, justifying the native parser Worker (1.18 kB production chunk). These are Node workload measurements, not browser responsiveness or peak-memory evidence.
- Read-only inventory fixture correctly distinguished unreferenced Local bytes from archived/content/directly referenced Local/S3 objects. No objects were deleted.

## Remaining release qualification

- Actual cover-churn workload and operational capacity measurements.
- Fresh production-browser accessibility/performance matrix and screenshots for the later implementation changes; earlier audit captures are historical evidence only.
- Real MySQL/PostgreSQL qualification on a Docker-capable host.
- Additional validation admission/stream-closure instrumentation and peak-memory measurements.

The user requested commit and push at this checkpoint. This publishes the implementation branch; it does not constitute deployment, merge, production cleanup or unconditional production-readiness approval.
