# Bookmarks Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the bookmarks audit's release gaps, make maintenance predictable, and validate the complete capture/import/read experience under supported workloads.

**Architecture:** Keep bookmarks as ordinary link-bearing memos, with existing memo permissions, Space placement, editor, attachment storage and React Query ownership. Extend existing fetch, maintenance and presentation paths rather than introduce a bookmark database or job framework. Deliver the phases independently; authorization changes and destructive cleanup have explicit gates.

**Tech Stack:** Existing Go/Echo/Connect services, SQLite/MySQL/PostgreSQL, protobufs, React/TypeScript/Vite, React Query, Vitest and Biome. Use the checked-in manifests for exact versions.

**Spec:** [Bookmarks implementation and production-readiness audit](../../bookmarks-production-readiness.md), dated 2026-09-06.

## Global Constraints

- Preserve the audit fixes: Space placement, draft restoration, Markdown AST dedupe, cancellation, conditional writes, image limits and network filtering.
- No separate bookmark entity, URL canonicalization service, new dependency or durable job system by default.
- Bookmark identity remains memo identity. Planned import dedupe covers the creator's NORMAL and ARCHIVED memos across placements; the current normal-only scan is extended in task 5. Refresh remains creator-wide across placements and archive states.
- Existing limits are 10 MiB per CSV, three import workers, five enriched links per memo, ten refresh workers per request, and a ten-second enrichment pass. Change a limit only with measured evidence and updated documentation.
- Obtain explicit approval before changing auth/token behavior, adding heavy dependencies or altering Docker/release workflows, as required by repository AGENTS.md. Task 7 describes the concrete auth change to approve.
- Never hand-edit generated protobuf outputs. Run generation and lint after changing sources. SQL schema changes require migrations and LATEST.sql parity for all three drivers.
- Preserve uncommitted work. The audit changes are present in the working tree; this plan does not assume they are committed or pushed.
- Prefix shell commands with `rtk`. Commands below run at repository root unless they explicitly change directory.
- Treat this as an implementation roadmap, not evidence that its unchecked work has already passed.

## Delivery order and release policy

| Phase | Tasks | Deliverable | Dependency |
| --- | --- | --- | --- |
| A: release foundations | 1–3 | Actual database evidence, safe logs, bounded outbound work | Existing audit changes |
| B: maintenance reliability | 4–5 | Repairable covers and stable maintenance scans | A; task 5 can precede 4 |
| C: user experience | 6 | Clear scope/cancellation copy, accessibility evidence, measured route/import performance | Final behavior from B |
| D: shared media and storage | 7–8 | Authorized shared covers; conservative storage lifecycle | Explicit task 7 approval; task 8 deletion requires its own design gate |
| Release qualification | 9 | Durable evidence for the supported deployment profile | All applicable preceding tasks |

Implement each numbered task as a separately reviewable change. Tasks 7 and 8 are distinct subprojects because authorization and deletion deserve independent approval and review. Run tasks sequentially by default; do not let multiple implementers edit enrichment simultaneously.

**Minimum release:** complete A–C, task 8's read-only inventory/operator procedure, and task 9 for every database advertised as supported. Shared collections may ship with the existing documented text fallback only if that limitation is explicitly accepted; shared visual parity requires task 7. Automated orphan deletion and unattended imports are not prerequisites for a bounded release.

## Audit coverage

| Audit limit or evidence gap | Plan response |
| --- | --- |
| Real MySQL/PostgreSQL execution missing | 1, 9 |
| URL-bearing server/browser logs | 2 |
| Per-request download concurrency multiplies | 3 |
| Existing broken cover UIDs skipped; stale image URLs | 4 |
| OFFSET scans shift during insert/delete | 5 |
| Foreground import cannot resume durably | 6: explain and test current contract; conditional extension below |
| Main-thread parsing and large initial bundles | 6: benchmark first, bounded corrective work |
| Five-link metadata ceiling | 6: document and verify content/dedupe preservation |
| Incomplete theme, zoom and assistive-technology checks | 6, 9 |
| Owner-only standalone covers in shared memos | 7 |
| Orphan attachments/blobs | 8 |
| Temporary screenshots, local-only smoke evidence | 9 |

## Task 1: Establish real cross-database release evidence

**Files:** inspect `store/test/main_test.go`, `store/test/containers.go`, `.github/workflows/backend-tests.yml`; extend `store/test/memo_payload_concurrency_test.go` only for missing boundaries. If a driver fails, modify the relevant `store/db/sqlite/memo.go`, `store/db/mysql/memo.go` or `store/db/postgres/memo.go`. Record results in new `docs/bookmarks-release-evidence.md`.

**Contract:** `UpdateMemo.ExpectedContent` and `ExpectedPayload` must reject stale snapshots through `store.ErrMemoConcurrentUpdate`, preserving both current content and payload. No production interface change is intended.

- [ ] Run existing tests on a Docker-capable host using the current TestContainers setup; do not rewrite CI to work around a missing local Docker installation.
- [ ] Check coverage for exact content matching (case, accents, trailing spaces), raw JSON representation, absent/empty payload, simultaneous author edit and refresh, and two maintenance writers. Add only absent regression cases. For two writes sharing a snapshot, assert exactly one succeeds and the loser is `ErrMemoConcurrentUpdate`; re-read the winner's payload.
- [ ] Run each driver explicitly so `-race` reaches that driver's integration execution. The all-driver harness launches child test commands, so an outer race flag alone is not sufficient evidence.

```bash
rtk proxy env DRIVER=sqlite go test -count=1 -v -race ./store/...
rtk proxy env DRIVER=mysql go test -count=1 -v -race ./store/...
rtk proxy env DRIVER=postgres go test -count=1 -v -race ./store/...
```

- [ ] Record engine versions, exact source revision/diff identity, command, exit code and concurrency cases in the evidence file. If Docker remains unavailable, mark MySQL/PostgreSQL release qualification blocked; retain the exact commands above.

**Acceptance:** all three real engines preserve newer author data. Package compilation is not a substitute for engine execution.

## Task 2: Remove sensitive URLs from failure logs

**Files:** `server/router/api/v1/memo_service_link_enrichment.go`, `internal/httpgetter/html_meta.go`, `web/src/components/BookmarksImport/useBookmarkImport.ts`; tests in `server/router/api/v1/memo_service_link_enrichment_test.go`, `internal/httpgetter/html_meta_network_test.go`, `web/tests/bookmarks-import.test.tsx`.

**Contract:** fetch failures remain diagnosable without URL userinfo, query, fragment, path or nested raw errors entering logs. No public API changes.

- [ ] Trace every log call in these paths, including wrapped HTTP errors and browser console calls. Reuse an existing safe logging helper if it provides this contract; otherwise keep small private helpers next to their callers.
- [ ] Add a log-capture regression using the synthetic URL below. Cause metadata failure, image failure and import failure; assert captured output contains none of the sensitive markers. Include malformed URL and cancellation cases.

```text
https://sample-user:sample-pass@example.test/private-path?token=sample-secret#sample-fragment
Forbidden in logs: sample-user, sample-pass, private-path, sample-secret, sample-fragment
Allowed context: memo ID or row number; operation; bounded error category
```

- [ ] Replace raw URL/error fields with safe operation, row/memo identity and categories such as `timeout`, `cancelled`, `http_status` or `fetch_failed`. Avoid logging full errors whose message may embed the URL; hostname is optional and should be omitted where private hostnames matter.
- [ ] Verify UI error messages remain useful and do not echo credentials. Document that this change prevents new leakage and does not purge historical logs; retention remains an operator policy.

```bash
rtk proxy go test -race ./internal/httpgetter ./server/router/api/v1
rtk proxy sh -c 'cd web && pnpm test tests/bookmarks-import.test.tsx --maxWorkers 2'
```

**Acceptance:** synthetic secrets never appear in captured server/browser logs, while failures and cancellations remain distinguishable.

## Task 3: Bound cover downloads across simultaneous requests

**Files:** `internal/httpgetter/html_meta.go`, `internal/httpgetter/html_meta_image_test.go`; inspect fetcher construction and all `GetImage` callers before editing.

**Contract:** preserve `GetImage(ctx context.Context, urlStr string) (*Image, error)`. Reuse the existing `HTMLMetaFetcher` lifetime and installed weighted semaphore. The limit is per server process, not a distributed quota.

- [ ] Confirm production enrichment and refresh share the fetcher instance. If they do not, wire the existing shared service instance through those callers rather than create package-global mutable state.
- [ ] Add a concurrent HTTP test with blocked responses and atomic in-flight counters. Start more downloads than the proposed capacity; cancel one waiting request and verify it never reaches the HTTP handler, then release requests and verify all permits return after success and error.
- [ ] Add `imageSemaphore *semaphore.Weighted` to `HTMLMetaFetcher`, initialized with `semaphore.NewWeighted(maxConcurrentFetches)` (currently eight) in `NewHTMLMetaFetcher`. Include semaphore wait in a five-second image context budget and hold the permit until the response body is closed. Do not nest acquisition of the metadata semaphore.

```go
// Inside GetImage, before admission and request construction:
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel()
if err := f.imageSemaphore.Acquire(ctx, 1); err != nil {
    return nil, err
}
defer f.imageSemaphore.Release(1)
// Continue through the existing safe client and size-checked body read.
```

- [ ] Exercise multiple refreshes and ordinary capture together. Record maximum outbound requests, cancellation latency and capture delay. Keep eight as the initial limit only if capture remains within the existing ten-second pass budget; do not add configuration without a deployment need.

```bash
rtk proxy go test -count=1 -race ./internal/httpgetter ./server/router/api/v1
```

**Acceptance:** image download concurrency never exceeds eight per shared fetcher; cancelled waiters send no request; capacity recovers after every exit. Multiple replicas are explicitly outside this process-local guarantee.

## Task 4: Repair missing or corrupt cached covers safely

**Files:** `server/router/api/v1/memo_service_link_enrichment.go`, `server/router/api/v1/attachment_service_storage.go`, `server/router/api/v1/memo_service_link_metadata.go`, `server/router/api/v1/v1.go`, `internal/httpgetter/html_meta.go`, `store/attachment.go`, `store/db/sqlite/attachment.go`, `store/db/mysql/attachment.go`, `store/db/postgres/attachment.go`, `web/src/hooks/useBookmarkCoverRefresh.ts`. Tests: `server/router/api/v1/memo_service_link_refresh_test.go`, `server/router/api/v1/memo_service_link_enrichment_test.go`, `server/router/api/v1/link_metadata_test.go`, `server/router/api/v1/test/attachment_service_s3_test.go`, `store/test/attachment_test.go`, `internal/httpgetter/html_meta_image_test.go`, `web/tests/bookmarks-page.test.tsx`. Reuse the streaming contract in `internal/storage/driver.go`; no driver interface expansion is needed for bounded S3 reads.

**Contract:** keep the existing refresh RPC and counters. Explicit refresh validates cached covers; ordinary memo reads do not fetch or decode covers. A failed replacement keeps the previous UID and reports failure; a successful replacement is published only through the existing content/payload CAS.

- [ ] Add fixtures for a healthy cover, missing attachment row, missing local file, missing S3 object, valid header with truncated pixel data, excessive dimensions, oversized stored bytes, expired remote image URL, failed replacement, cancellation and concurrent memo edit. Reuse existing storage test helpers.
- [ ] Add a private `readLinkCoverBlob(ctx context.Context, attachment *store.Attachment) ([]byte, error)` in the API storage file. Resolve attachment ownership before reading; query metadata without loading blobs first. For Local, open the file and read through `io.LimitReader(reader, (5<<20)+1)`; for S3, use the existing `GetObjectStream` and the same limited reader, closing the stream on every exit. Reject more than 5 MiB. Do not call the unbounded `GetAttachmentBlob`/`GetObject` on this validation path. For legacy database blobs, add optional `BlobReadLimit *int` to `FindAttachment`: when GetBlob is true and the limit is positive, select only that many bytes using the driver's blob substring expression. Request `(5<<20)+1`, then reject overflow; nil preserves existing callers. Test actual oversized data with a falsely small Size field across all drivers. Reject EXTERNAL/unknown storage; never fetch arbitrary external references through this storage helper.
- [ ] Add a service-owned `coverValidationSemaphore *semaphore.Weighted`, initialized with two permits in `NewAPIV1Service` in `v1.go`. Acquire before stored-byte reads or replacement validation and release after decoding. Use a five-second context for admission and storage I/O. Check cancellation before and after decoding; Go image decoders are synchronous and not preemptible by context, so do not claim immediate mid-decode cancellation. Limit outstanding decodes to two, even across refresh requests; task 3's HTTP semaphore is a separate limit. Never hold the validation permit while waiting for an image download.
- [ ] Add private `validateLinkCover(blob []byte) (width int32, height int32, err error)`: verify byte size, use `image.DecodeConfig` only as a preflight, reject dimensions above 4096 on either axis or above 8,000,000 pixels using division to avoid overflow, then fully decode with `image.Decode` and require success and matching bounds. Support static JPEG, PNG and WebP using registered decoders. Reject GIF, animated PNG (`acTL` chunk) and animated WebP (animation flag/chunks), and unknown formats as unsupported in this initial repair validator; do not classify them as healthy or delete them. These conservative repair limits do not restrict ordinary attachment uploads. Record them in the operational documentation and measure peak memory with the two-permit limit before release.

```go
// Preflight before full decoding; errors use the existing pkg/errors package.
if len(blob) > 5<<20 {
    return 0, 0, errors.New("cover exceeds byte limit")
}
config, format, err := image.DecodeConfig(bytes.NewReader(blob))
if err != nil {
    return 0, 0, errors.Wrap(err, "invalid cover header")
}
if config.Width <= 0 || config.Height <= 0 || config.Width > 4096 ||
    config.Height > 4096 || config.Width > 8_000_000/config.Height {
    return 0, 0, errors.New("cover exceeds dimension limit")
}
switch format {
case "jpeg", "png", "webp":
default:
    return 0, 0, errors.New("unsupported cover format")
}
// Enforce the static-format policy above before image.Decode.
decoded, _, err := image.Decode(bytes.NewReader(blob))
if err != nil {
    return 0, 0, errors.Wrap(err, "invalid cover pixels")
}
if decoded.Bounds().Dx() != config.Width || decoded.Bounds().Dy() != config.Height {
    return 0, 0, errors.New("cover dimensions mismatch")
}
return int32(config.Width), int32(config.Height), nil
```

- [ ] Validate both existing cached bytes and newly downloaded replacement bytes. A supported valid cover counts as skipped; missing/corrupt/unsupported cover attempts a bounded replacement and reports failure with the old reference intact if no valid replacement is available. Do not run this scan in normal reads.
- [ ] For a broken cover, fetch into a cloned candidate entry rather than mutating the live payload. The cache lookup must not return the same known-broken candidate merely because its filename matches. For other cache hits, validate before reuse on the repair path; do not trust stored dimensions alone.
- [ ] Make repair candidate storage immutable: assign a fresh attachment UID and append it to the final expanded Local path/S3 key before writing, independent of whether the configured template contains `{uuid}`. Keep the logical cover filename for lookup, but separate it from physical object identity. Add a private cover-candidate mode to the existing storage helper; ordinary upload callers retain existing behavior. A candidate is written once and never reuses an old reference/key; an upload retry that starts over allocates a new candidate identity. Preserve the old object on every save/CAS failure and leave unreferenced candidates to task 8's conservative policy.

```text
logical filename: link-cover-<URL hash>
expanded template: covers/link-cover-<URL hash>
candidate key: covers/link-cover-<URL hash>.<fresh attachment UID>
old key: unchanged, including templates containing only {filename}
```

- [ ] Add an S3 regression using a filename-only template and two memos sharing an old cover. Inject both attachment creation failure and memo CAS failure after candidate upload. Assert the old object's bytes/key and both unaffected memo references remain unchanged; a successful repair updates only the intended memo. Repeat the physical isolation assertion for Local storage and test two simultaneous candidate uploads.
- [ ] If the stored image URL fails, allow one fresh page-metadata fetch bypassing the 24-hour successful cache, using the same SSRF-safe client, concurrency admission and timeout. Add `GetFresh(ctx context.Context, urlStr string) (*HTMLMeta, error)` to the existing fetcher and the `linkMetadataFetcher` service interface, updating all fake/counting implementations in the named tests. Share normal fetch/cache logic; isolate fresh singleflight work from cache-serving in-flight calls so the bypass cannot return the same stale result.

```text
healthy cached attachment -> skipped
broken/missing cached attachment -> download replacement candidate
stored image URL fails -> refresh page metadata once -> retry new image once
candidate fully validated + unique object persisted + memo CAS succeeds -> updated
fetch/storage failure -> retain old reference; failed
memo CAS conflict -> do not overwrite winner; candidate handled by task 8 policy
```

- [ ] Keep obsolete attachments until safe cleanup exists; never delete a cover as part of a failed repair. Verify new dimensions and all memo query invalidations. Document that deliberate re-fetch of a healthy but visually stale cover is outside this repair command's initial scope.

```bash
rtk proxy go test -race ./internal/httpgetter ./server/router/api/v1/...
rtk proxy sh -c 'cd web && pnpm test tests/bookmarks-page.test.tsx --maxWorkers 2'
```

**Acceptance:** deleted/corrupt cached covers recover where a supported source remains available; healthy supported covers avoid network replacement. Unsupported/over-limit candidates report failure and retain the old reference. Failed repair cannot change old object bytes, lose a usable reference or overwrite a concurrent author edit. Byte/pixel limits, bounded storage reads and the two-validation concurrency ceiling have regression evidence.

## Task 5: Replace OFFSET in maintenance scans with an ID cursor

**Files:** `store/memo.go`, `store/db/sqlite/memo.go`, `store/db/mysql/memo.go`, `store/db/postgres/memo.go`, `server/router/api/v1/memo_service.go`, `server/router/api/v1/memo_service_query.go`, `server/router/api/v1/memo_service_link_enrichment.go`, `proto/api/v1/memo_service.proto`, `web/src/components/BookmarksImport/useBookmarkImport.ts`; existing refresh/import tests and new `store/test/memo_scan_cursor_test.go`.

**Contract:** ordinary collection ordering remains unchanged. Introduce an opt-in scan order `id asc` for `ListMemos`; import requests it. Refresh uses the same internal bounded-ID scan. IDs remain internal and cursors opaque to clients. This stabilizes traversal under inserts/deletes; it does not freeze content or membership in a filter while users edit.

- [ ] Add `AfterID *int32`, `MaxID *int32`, and `OrderByIDAsc *bool` to `store.FindMemo`. Nil preserves existing ordering, true means exclusively ID ascending, and false means exclusively ID descending for the internal fence query. Implement equivalent predicates/order in all drivers; when non-nil do not append pinned, timestamp or the existing ID-descending tie-breaker. Reject contradictory pinned/time flags in the store scan branch.
- [ ] Capture the first-page fence with a copy of the same authorized creator/filter/state/scope predicates, `OrderByIDAsc = proto.Bool(false)`, a local `one := 1` assigned through `Limit = &one`, `ExcludeContent = true`, and no offset/cursor bounds. Use the returned row ID as MaxID, or return an empty terminal page if there is none. This bounded descending-ID query avoids loading the whole library. Then fetch `limit + 1` ascending rows within the fence; emit the first `limit`, and advance AfterID from the last emitted store row, never the lookahead row.

```sql
-- Apply existing creator/access/filter predicates as well:
WHERE id > :after_id AND id <= :max_id
ORDER BY id ASC
LIMIT :page_size_plus_one
```

- [ ] Define a versioned opaque scan token containing last ID, maximum ID and a hash of normalized scan inputs: caller identity (including anonymous), creator predicate, effective lifecycle state, filter, exact scan order and collection scope. Refresh uses a distinct operation discriminator and all-states marker; ListMemos uses effective NORMAL or ARCHIVED. Validate nonnegative IDs with `last <= max`, version and input match. Bind the normalized page size too, retaining it for continuation. Always reconstruct caller authorization and current membership from the request; a token/hash never grants access or guarantees tamper resistance.
- [ ] Extend the order parser with only standalone `id asc` after whitespace normalization. Reject `id`, `id desc`, `pinned, id asc`, `id asc, update_time`, repeated ID fields and extra tokens. Keep all existing non-ID list modes and their tokens unchanged. Use an internal token struct/codec for ID scans; update proto ordering documentation and regenerate outputs.
- [ ] Refresh emits new scan tokens; accept valid legacy numeric offsets for an in-progress old client run under the legacy behavior, then require a fresh run for the stable guarantee. Do not silently interpret old offsets as IDs.
- [ ] Switch import dedupe to two explicit `id asc` scans: first `State.NORMAL`, then `State.ARCHIVED`, each with its own initially empty page token/fence. Merge into one URL Set before scheduling any creation. Keep the creator filter and omit a Space restriction in both scans. Failure/cancellation in either scan prevents all writes. Preserve full Markdown extraction. This intentionally extends current normal-only dedupe to archived links; update the audit only after implementation.
- [ ] Document concurrency limits: neither scan freezes memo contents, and lifecycle moves between the two scans can still evade detection. Concurrent imports and URL/state edits remain best-effort dedupe without a uniqueness contract; do not call this exactly-once import or a snapshot.
- [ ] Add a store regression: first page returns IDs 10 and 20 with fence 40; delete 10 and insert 50; later pages return 30 and 40 exactly once and exclude 50. Verify all three engines, empty/terminal pages and tied timestamps. Add API regression cases in new `server/router/api/v1/memo_service_scan_test.go`: reject every mixed/unsupported ID order above, changed caller/filter/state/page size, wrong operation token and malformed tokens; ensure lookahead ID 30 becomes the first row of page two, not an omitted row. Add import tests for archived-only URLs, the same URL in both states/across Spaces, and second-scan failure producing zero creates.

```bash
rtk proxy sh -c 'cd proto && buf generate && buf lint'
rtk proxy env DRIVER=sqlite go test -race ./store/...
rtk proxy env DRIVER=mysql go test -race ./store/...
rtk proxy env DRIVER=postgres go test -race ./store/...
rtk proxy go test -race ./server/router/api/v1
rtk proxy sh -c 'cd web && pnpm test tests/bookmarks-import.test.tsx --maxWorkers 2'
```

**Acceptance:** inserts/deletes cannot shift stable scan pages; existing collection sort behavior and authorization remain intact. No claim of exactly-once importing under concurrent URL edits or separate imports.

## Task 6: Finish UX, accessibility and measured performance

**Files:** `web/src/pages/Bookmark.tsx`, `web/src/pages/Bookmarks.tsx`, `web/src/components/BookmarksImport/BookmarksImportDialog.tsx`, `web/src/components/BookmarksImport/useBookmarkImport.ts`, `web/src/components/BookmarksImport/csv.ts`, `web/src/components/MemoView/MemoView.tsx`, `web/src/components/MemoView/bentoCover.ts`, `web/src/locales/en.json`, `DESIGN.md`; relevant existing `web/tests/bookmark*.test.*`. Performance fixes may touch `web/src/router/index.tsx` and `web/vite.config.mts` only after attribution.

**Contract:** keep the shared editor and semantic theme tokens. The user can understand scope, saved progress, failures and retry consequences without implementation terminology.

- [ ] Add these meanings to nearby action/helper/result copy, using existing translation keys/patterns: “Checks your bookmarks across all Spaces”; “Keep this page open while importing”; “Stopping keeps links already saved”; “Checks saved and archived links across all your Spaces for duplicates.” This copy depends on task 5's completed NORMAL + ARCHIVED scans; it must not ship against the current normal-only scan. Refresh copy also states that archived bookmarks are included. Show created/skipped/failed separately.
- [ ] Test that cancellation preserves completed counts, completed imports do not restart accidentally, and failed rows can be retried through reimport. Verify that a memo containing six links retains all six and dedupe detects the sixth even though only five receive metadata. Document URL variants remaining distinct.
- [ ] Run the following actual-browser matrix against a production build with a real backend; store screenshots and observations in release evidence.

| Scenario | Required observation |
| --- | --- |
| 375px, 768px, 1280px; light and dark | No horizontal overflow, clipped dialogs or unreadable cover/text states |
| 200% zoom and keyboard-only | URL entry, save, import, stop and card navigation work; focus visible and restored after dialogs |
| Screen reader | Input errors, progress, cancellation and final counts announced without repeated focus jumps |
| Slow/failed image; text-only card | Title remains readable; focus and card navigation remain usable |
| Empty collection, load failure, failed autosave | Explicit recovery and preserved draft/placement |
| Long translated labels and reduced motion | Actions fit and no essential state depends on animation |
| Space capture and refresh | Saved memo appears in selected Space; refresh scope explanation matches creator-wide operation |

- [ ] Measure CSV parse time, dedupe time, longest main-thread task and peak memory for small files and near-10-MiB files with many short rows and long quoted fields. Measure cancel-button responsiveness during scanning and writing. Use fixed generated synthetic fixtures without private URLs.
- [ ] Use initial engineering targets of no >200ms import-induced UI stall and acknowledgement of Stop within 250ms on the documented test device. These are proposed acceptance targets, not measurements from the audit. If parsing misses them, move the existing pure CSV parser to a native Web Worker in new `web/src/components/BookmarksImport/csv.worker.ts`; terminate it on file replacement/close. If scanning misses them, yield between bounded batches before considering a new endpoint or persistent index.
- [ ] Measure cold capture/collection navigation from the production build with fixed network/CPU settings. Record route requests, transferred bytes and time to usable URL input/editor. Attribute the application/editor/locale chunks before changing them; defer editor loading until Continue if the current import graph loads it unnecessarily, and avoid eagerly importing all locales where attribution proves that cause. Do not claim a Lighthouse score unless actually measured.
- [ ] Re-run the same measurements after any change and reject a bundle optimization that regresses editor readiness, translations or draft restoration. Record an explicit supported device/workload envelope if the maximum file still exceeds responsiveness targets.

```bash
rtk proxy sh -c 'cd web && pnpm lint && pnpm test --maxWorkers 2 && pnpm build'
```

**Acceptance:** every matrix row has observed evidence or a named release limitation; no data-loss/focus/keyboard blocker remains. Large-file and route-speed claims include device, fixture and before/after measurements.

## Task 7: Provide shared covers through memo authorization

**Approval gate:** AGENTS.md requires approval before auth behavior changes. Submit this task's route, access matrix and cache policy for approval before implementation. Standalone attachment permissions remain unchanged.

**Files:** `server/router/fileserver/fileserver.go`, `server/router/fileserver/fileserver_test.go`, `server/router/fileserver/README.md`, `web/src/components/MemoView/bentoCover.ts`, `web/src/components/MemoView/MemoView.tsx`, `web/src/utils/attachment.ts`, `web/src/components/MemoContent/LinkMetadataCard.tsx`, `web/src/components/MemoContent/markdown/Paragraph.tsx`, `web/src/components/MemoContent/MarkdownRenderContext.tsx`, `web/src/components/MemoContent/MemoMarkdownRenderer.tsx`. Trace other cached-cover URL builders and update those consumers too.

**Proposed interface:** native GET route `/file/memos/:memoUID/covers/:attachmentUID`; accept the existing `share_token` query convention. This native route is registered in `FileServerService.RegisterRoutes`, not the Connect ACL map. If implementation instead adds a public RPC, its ACL entry is required separately.

- [ ] Add failing access tests before changing permission helpers: owner, accepted Space reader, unrelated user, public anonymous reader, anonymous-disabled instance, valid exact-memo share token, expired/wrong-memo share token, revoked membership and a private memo.
- [ ] Resolve the memo, verify its current payload references the requested cover UID and verify cover creator matches memo creator. Reuse `access.ResolveMemoReadFacts`, `WithViewer` and `access.CheckMemoReadContext` from current attachment permission evaluation. Extract only the shared memo-read calculation needed by the two routes.

```text
resolve memo + attachment
require attachment UID in this memo's current links
require matching creator ownership
apply existing memo read policy, including exact share-token rules
serve through existing storage/thumbnail helpers
```

- [ ] Reject guessed attachment UIDs and a token valid for a different memo. Never authorize by filename, URL origin or mere existence of a reference supplied by the request.
- [ ] Use `Cache-Control: private, no-store` initially for this route so revocation is not undermined by shared caches. Assert the final response header after storage/thumbnail helpers run, including conditional/range responses, so existing serving defaults cannot overwrite it. Never put tokens in logs. Apply existing response security headers and content handling.
- [ ] Thread `memoName?: string` and the current share context from the markdown renderer/context through Paragraph into LinkMetadataCard; the card currently receives neither memo identity nor share context. Build memo-scoped cached-cover URLs for both flow and bento. Without a memo identity, retain existing standalone owner-only behavior; never infer access from the external link URL.
- [ ] Update cover URLs on shared memo surfaces, carrying the current share token only where the existing page already uses one. Prefer locally authorized cover delivery; avoid a new automatic third-party image fallback that exposes reader requests. Preserve text fallback when no cover exists.
- [ ] Exercise Local and S3 delivery, revoked access after a previously successful request, and the public/Space/browser flows. Verify the old standalone attachment URL remains owner-only.

```bash
rtk proxy go test -race ./server/router/fileserver ./server/router/api/v1
rtk proxy sh -c 'cd web && pnpm lint && pnpm test --maxWorkers 2 && pnpm build'
```

**Acceptance:** viewers who can read the referenced memo can read its cover; unrelated standalone attachments remain protected. Authorization approval and access-matrix evidence are required before enabling this behavior.

## Task 8: Make cover storage growth observable before deletion

**Files:** inspect `store/attachment.go`, `server/router/api/v1/memo_service_link_enrichment.go`, `proto/store/attachment.proto`, `store/test/attachment_delete_test.go`; create `docs/bookmark-cover-storage.md` for inventory, operations and the deletion design.

**First deliverable:** a read-only inventory/procedure and measured growth, not a scheduled garbage collector. Existing attachments have no explicit managed-cover marker; filename resemblance is insufficient deletion authority.

- [ ] Document all reference forms: link payload UIDs, direct memo attachments and any Markdown attachment URLs. Include all creators, archive states and placements. Inventory apparent cover candidates separately from proven unreferenced objects; count bytes by Local/S3 storage and age.
- [ ] Run a bounded churn experiment: create, change link, repair, induce CAS conflict and delete memo. Compare attachment rows and blob counts before/after; use synthetic data. Check blob-write/row-create failure paths independently because blob-only orphans have no attachment row to inspect.
- [ ] Record immediate operational controls: disk/object growth monitoring, capacity alert threshold chosen from actual deployment headroom, and read-only candidate export. Do not include private URLs or credentials in the export.
- [ ] Produce a separate concrete deletion design before implementing automated cleanup. It must define a managed-cover provenance marker, conservative handling of legacy candidates, a minimum 24-hour grace period, reference recheck and exclusion from concurrent cache reuse, shared blob-reference handling, and crash recovery between database and storage operations.
- [ ] Require a transactional claim/tombstone or equivalent proven serialization across processes; a process-local mutex or “check then delete” does not prevent another writer referencing the cover. Extend all three drivers if a database claim is needed. A payload marker requires protobuf regeneration; a schema change requires all driver migrations and LATEST.sql updates.
- [ ] Specify failure tests in that design: newly referenced candidate survives, generic uploaded attachment survives, shared cover survives, repeated run is idempotent, object deletion failure is retryable, and crash between claim/delete/finalize cannot restore a broken reference. Preserve retry metadata until physical deletion succeeds.
- [ ] Keep deletion disabled until this design is approved and those tests pass against real drivers and supported storage. Snapshot rows and back up objects before the first destructive run; limit the initial batch and inspect its result.

**Acceptance for this roadmap:** storage growth is quantified and operators have a safe inventory procedure. Automatic cleanup is a separately approved deliverable; do not mark orphan leakage solved merely because inventory exists.

## Task 9: Qualify the final release and preserve evidence

**Files:** update `docs/bookmarks-production-readiness.md`, new `docs/bookmarks-release-evidence.md`, and relevant user-facing operational documentation from tasks 6–8.

- [ ] Record the exact final source revision plus uncommitted diff identity if applicable; earlier passing tests are baseline evidence, not validation of subsequent edits.
- [ ] Run the relevant final checks below. Use a host with Docker for all-driver coverage. Re-run protobuf generation/lint only if protobuf sources changed; include generated outputs in the reviewed diff.

```bash
rtk proxy go test -v -race ./internal/...
rtk proxy go test -v -race ./server/...
rtk proxy env DRIVER=sqlite go test -count=1 -v -race ./store/...
rtk proxy env DRIVER=mysql go test -count=1 -v -race ./store/...
rtk proxy env DRIVER=postgres go test -count=1 -v -race ./store/...
rtk proxy sh -c 'cd web && pnpm lint && pnpm test --maxWorkers 2 && pnpm build'
rtk proxy git diff --check
```

- [ ] Smoke the built release against isolated Local and S3 storage: reviewed capture, bookmarklet autosave, attachment/draft reload, Space placement, mixed CSV outcomes, cancellation, archived-only dedupe and failure of its second scan, page-boundary refresh and concurrent author edit. Require task 4's same-key-template failure isolation and truncated/oversized image cases plus task 5's mixed-order, state-binding and lookahead regressions in final automated evidence. Include task 7's reader matrix and final no-store headers if enabled.
- [ ] Copy selected screenshots and measurement outputs out of `/private/tmp` into a durable release artifact location; record URLs/paths in the evidence document. Redact account details and URLs. Do not copy the excluded earlier `.png` captures from the audit.
- [ ] Review deployment-specific limits: database verified, process/replica count, storage capacity, supported CSV size/device envelope, shared-cover behavior and foreground import contract. Each unresolved row gets an owner and explicit supported limitation; security/data-loss regressions block release.
- [ ] Define rollback for each behavior change: deploy the previous application build; retain cached objects; stop any new maintenance operation. Cursor changes require clients to restart active maintenance runs after rollback. If later cleanup introduces migrations, add its own tested restore procedure before deployment.
- [ ] Update the audit findings to distinguish fixed, measured, accepted limit and deferred work. Do not turn the report into an unconditional “production-ready” claim.

**Acceptance:** a reviewer can reproduce release checks, inspect browser evidence and identify remaining limits without reading the implementation conversation.

## Conditional extensions, with explicit triggers

- **Durable imports:** only if imports must continue after closing the page or exceed the supported foreground envelope. Before implementation, define persisted row identity, idempotency, cancellation, permission revalidation and restart semantics as a separate spec. Reimport remains the current recovery path.
- **More than five enriched links:** only if multi-link metadata coverage becomes a product requirement. Preserve all content now; do not enlarge synchronous save work merely to enrich later links.
- **Always-fresh healthy covers:** only if users need manual replacement of visually stale but valid images. Add an explicit force mode and test cache bypass/old-cover retention; routine repair in task 4 is sufficient for broken assets.
- **Distributed download quotas:** only when replica-level load demonstrates that per-process admission is insufficient. Document the deployment ceiling before adding coordination infrastructure.
- **Automatic orphan deletion:** only after task 8 establishes material growth and its concurrency/crash-safe deletion design passes review.

## Plan self-review

- [x] Every residual audit row maps to a task or explicit conditional extension.
- [x] Completed audit fixes are baseline constraints, not duplicated implementation tasks.
- [x] Existing file targets were checked; proposed new files and interfaces are labeled.
- [x] Stable ID traversal is distinguished from a content snapshot and exact-once import.
- [x] Shared-cover authorization and destructive cleanup have separate gates.
- [x] Commands use existing test tooling; real-engine coverage is distinguished from compilation.
- [x] No implementation or future verification result is claimed by this document.
- [x] Review findings are resolved in the design: physical replacement isolation, bounded full validation, explicit archived dedupe and exclusive/state-bound ID scans.
