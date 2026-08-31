# Link Cover Fetch Retry

Status: Implemented

> Review pass found and fixed one real defect: persisted pre-feature entries have
> `first_attempt_at = 0`, so the naive stop rule would mark them exhausted immediately
> and never retry the covers this plan exists to fix — a zero-value initialization rule
> (fresh 24h window) is now specified, with a matching regression test. Also corrected:
> store protos do emit web TS outputs (Files table), and the 5-link-per-memo ceiling
> now explicitly applies to retries too. Backoff arithmetic verified: 9 fetches max
> before the 24h cutoff.

## Goal

When fetching a link's metadata/cover fails at memo write time, retry with increasing
delays (backoff), keep retrying until 24h after the first failure, then stop for good.
Server-only change.

## Current behavior (verified)

- `EnrichMemoLinks` (server/router/api/v1/memo_service_link_enrichment.go) runs
  synchronously on create/update with a 10s whole-pass budget.
- **Metadata fetch fails** → `enrichLink` returns nil → entry is *absent* from
  `Payload.Links` → retried on every edit and every startup `RunOnce`, with no backoff
  and no stop.
- **Cover fetch fails** (`GetImage` error in `cacheLinkCover`) → entry *is* persisted
  with `cover_attachment_uid` empty → "reuse existing entries" branch means it is
  **never retried** — the card falls back to the remote `og:image` URL, which may 403
  or rot. This is the user's complaint.
- `RebuildMemoPayload` (server/runner/memopayload/runner.go:110-111) only rewrites
  `Tags` and `Property` — `Links` survive rebuilds, so retry state can live there.
- `LinkMetadataCard` falls back to the plain link when a stored entry has no
  title/description (`hasUsefulMetadata`), so persisting failed entries is visually
  identical to today's absence. Client live-fetch still runs (`useLinkMetadata`).
- The runner currently fires once at startup (`server/server.go:81`,
  `go memoPayloadRunner.RunOnce(ctx)`), so there is no periodic retry driver today.

## Design

### Retry state (proto/store/memo.proto, compatible additions)

```proto
message LinkMetadata {
  ...
  // Retry bookkeeping for failed metadata/cover fetches. Zero on success.
  int32 fetch_attempts = 6;
  // Unix seconds of the first failed attempt; retrying stops 24h after this.
  int64 first_attempt_at = 7;
  // Unix seconds of the most recent failed attempt; drives the backoff gate.
  int64 last_attempt_at = 8;
}
```

Run `cd proto && buf generate && buf lint`. Store payloads are blobs — no DB migration.

### Backoff

`backoffDelay(attempts)`: 5m, 15m, 30m, 1h, 2h, 4h, then 8h for all later attempts.
A retry is allowed when `now >= last_attempt_at + backoffDelay(attempts)`.
Stop condition: `now - first_attempt_at >= 24h` → never fetch that URL for that memo
again. Worst case ≈ 9 fetches across the day (0m, 5m, 20m, 50m, 110m, 230m, 470m, 950m,
then next slot at 1910m > 24h). On success, clear all three fields.

**Zero-value rule (legacy entries):** entries persisted before this feature have
`first_attempt_at = 0`, which the stop rule would read as "exhausted in 1970" and never
retry — precisely the already-broken covers this plan targets. When a retry is needed
and `first_attempt_at == 0`, initialize `first_attempt_at = last_attempt_at = now` and
`fetch_attempts = 1` before applying the gate, giving legacy failures a fresh 24h window.

### EnrichMemoLinks changes

Per content URL:

1. Entry exists, `cover_attachment_uid` set (or entry has image+metadata and nothing to
   fetch) → reuse as today.
2. Entry exists but **cover missing** (`image` set, `cover_attachment_uid` empty) →
   retry `cacheLinkCover` when the gate allows; on success fill the uid and clear retry
   fields; on failure bump attempts/timestamps (keep title/description).
3. Entry exists but **metadata itself failed** (no title/description/image — newly
   persisted on failure, see 4) → gate-gated full re-fetch.
4. Entry absent → full attempt as today, but on metadata failure persist
   `{url, fetch_attempts: 1, first_attempt_at: now, last_attempt_at: now}` instead of
   omitting the entry. Renders as the plain-link fallback (card already handles it).
5. Gate says wait, or 24h window passed → keep the entry untouched (failed state is
   idempotent; exhausted entries are just dead weight, no explicit tombstone field).

Create/update latency stays bounded by the existing 10s `enrichTimeout`; gated retries
are skipped cheaply. The retry loop inherits the existing `maxEnrichLinksPerMemo = 5`
ceiling — links beyond the fifth in one memo are neither enriched nor retried (same as
today).

### Retry driver

Convert the startup-only runner into a loop: `RunLoop(ctx)` runs `RunOnce` at startup
and every 15 minutes via `time.Ticker`, wired in `server/server.go:81`.
// ponytail: RunOnce still full-scans memos each pass — fine at self-host scale;
// index payload-links-pending if a deployment ever has 100k+ memos.

## Files

| File | Change |
| --- | --- |
| `proto/store/memo.proto` | +3 LinkMetadata fields |
| `proto/gen/**` | `buf generate` outputs — Go **and** web TS: store protos also emit to `web/src/types/proto/store` (generated, never hand-edited) |
| `server/router/api/v1/memo_service_link_enrichment.go` | backoff helper + retry branches 2-5 |
| `server/runner/memopayload/runner.go` | `RunLoop(ctx, 15m)` ticker wrapper |
| `server/server.go` | call RunLoop |
| `server/router/api/v1/memo_service_link_enrichment_test.go` | new cases below |
| `server/router/api/v1/memo_service_backoff_test.go` (or same file) | backoff table + stop rule |

## Tests

- Backoff table: attempt 1 → 5m, 2 → 15m, 3 → 30m, 4 → 1h, 5 → 2h, 6 → 4h, 7+ → 8h.
- Stop rule: first_attempt_at 25h old → no fetch regardless of delay.
- Gate: last attempt 2m ago with attempts=1 → skipped.
- Zero-value migration: entry with all retry fields zero → gate initializes a fresh
  24h window instead of treating it as exhausted (regression test for legacy payloads).
- EnrichMemoLinks: cover-missing entry retried when allowed; success fills uid and
  clears retry fields; failure bumps attempts and preserves title/description;
  metadata-failed entry persisted on first failure (regression: previously omitted).
- Existing `link_metadata_test.go` / enrichment tests keep passing.

## Gates

`go test -race ./server/... ./internal/...` (watch the known unrelated
`TestDetectAttachmentMimeType` flake), `cd proto && buf lint && buf format --check`,
`go build ./...`. No web changes.

## Out of scope

- Client UI indicator for "cover pending" — card already falls back.
- GC of exhausted retry entries — negligible payload bytes.
- Retrying remote `og:image` reachability on the client.
