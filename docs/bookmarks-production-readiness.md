# Bookmarks implementation and production-readiness audit

Audit date: 2026-09-06. Scope: bookmark capture, Raindrop CSV import, collection filtering, shared memo presentation, link metadata, cached covers, refresh and background payload updates.

The implementation has been hardened against identified draft-loss, duplicate-detection, cancellation, stale-write and download-boundary failures. This is a bounded readiness assessment, not a claim that every deployment or workload is production-ready. Cross-database integration, shared-cover delivery and large-library operations retain the limitations below.

This pass changes no authentication or token behavior, public protobuf contract, database schema, release workflow or dependency manifest. Existing Markdown parsing dependencies and shared editor/query components are reused.

## Architecture and ownership

| Surface | Implementation | Behavior |
| --- | --- | --- |
| Bookmark identity | [Bookmark collection](../web/src/pages/Bookmarks.tsx), existing memo API/store | A bookmark is a memo containing a link. There is no separate bookmark entity or bookmark lifecycle. Memo resource names, visibility, Space placement, archive state and deletion remain authoritative. |
| Capture | [Bookmark page](../web/src/pages/Bookmark.tsx), [serialization](../web/src/lib/bookmark.ts) | `/bookmark` accepts a pasted URL or bookmarklet query parameters. A reviewed capture opens MemoEditor; `autosave=1` creates immediately. HTTP and HTTPS URLs are accepted. |
| Draft persistence | [Bookmark page](../web/src/pages/Bookmark.tsx), [editor initialization](../web/src/components/MemoEditor/hooks/useMemoInit.ts), [cache service](../web/src/components/MemoEditor/services/cacheService.ts) | Capture drafts are keyed by URL and Space, then namespaced by user. Existing content and attachment bindings are restored before the original URL seed. |
| Import | [dialog](../web/src/components/BookmarksImport/BookmarksImportDialog.tsx), [CSV parser](../web/src/components/BookmarksImport/csv.ts), [import hook](../web/src/components/BookmarksImport/useBookmarkImport.ts) | A Raindrop CSV becomes link memos with folder-derived tags, supplied tags, notes and highlights. The selected Space is captured for creation. |
| Collection | [Bookmarks](../web/src/pages/Bookmarks.tsx), [PagedMemoList](../web/src/components/PagedMemoList/PagedMemoList.tsx) | Normal-state link memos combine `has_link`, user filters and the current Space collection predicate. Existing sorting and pagination are reused. |
| Presentation | [MemoView](../web/src/components/MemoView/MemoView.tsx), [bento helpers](../web/src/components/MemoView/bentoCover.ts), [design contract](../DESIGN.md) | Flow and bento use shared memo surfaces. Bento prefers a cached link cover, then an image attachment; failed images become text tiles. The full-card action opens memo detail. |
| Metadata and cover cache | [link enrichment](../server/router/api/v1/memo_service_link_enrichment.go), [HTTP fetcher](../internal/httpgetter/html_meta.go) | The server enriches up to five extracted links per memo under a ten-second pass budget. Metadata resides in memo payload; cover images are standalone attachments owned by the memo creator. |
| Refresh | [frontend hook](../web/src/hooks/useBookmarkCoverRefresh.ts), [RPC implementation](../server/router/api/v1/memo_service_link_enrichment.go) | The browser requests pages of 20 memos. The server uses ten workers per request, processes the caller's link memos across all placements and archive states, and skips entries already carrying a cached-cover UID. |
| Background maintenance | [payload runner](../server/runner/memopayload/runner.go), [store contract](../store/memo.go), driver memo update implementations | Conditional content/payload comparisons prevent a stale maintenance snapshot from replacing a concurrent author update. |

Memo ID remains the internal stable identity; Memo UID is the public identifier inside a memo resource name. A Space is a collaboration and placement boundary, not an application role. The Bookmarks collection inherits these distinctions rather than defining a separate authorization model.

### Data and failure flow

Capture serializes the URL and escaped title into Markdown. The reviewed path uses the existing editor save transaction, preserving visibility controls and attachment behavior. Both reviewed and automatic capture now pass selected Space placement. Failed automatic creation removes `autosave` from the query parameters and leaves the original content and tags available for review and retry.

Import validates the file before reading it, parses rows, and scans the signed-in user's existing link memos before writing. Dedupe combines stored link metadata with Markdown AST link destinations, including resolved reference links. It also removes duplicates within the file. URL normalization protects Markdown destinations; it is not a general canonical-URL resolver and does not merge redirects, tracking variants or every semantically equivalent URL.

Import uses three concurrent creation workers. Failure to scan existing memos stops the import rather than risking an uncontrolled duplicate run. A failed row increments the failure count while other rows continue. Cancellation aborts the read phase or stops scheduling further writes; already-started writes finish and retain accurate completion counts. At the end, memo, user-stat and attachment-list caches are invalidated.

Cover enrichment is best effort: unavailable third-party metadata does not need to invalidate the memo itself. Failed entries retain retry state, with increasing delays and a 24-hour retry window. Explicit refresh starts a fresh attempt window for missing covers. Cached filenames derive from page and image URLs and are looked up within the creator's attachments. Width and height metadata support aspect-aware presentation.

## Findings addressed

| Finding and practical failure | Resolution | Main source |
| --- | --- | --- |
| Capture could create an unassigned memo from a Space-scoped collection, making the saved result disappear from that collection. | Reviewed and automatic capture pass selected Space placement. | [Bookmark.tsx](../web/src/pages/Bookmark.tsx) |
| Reloading a capture replaced edited notes and attachment bindings with its initial URL seed. A shared bookmark cache also mixed capture identities. | URL/Space-specific draft keys and existing cache restoration precede initialization; changing identity remounts the editor. | [Bookmark.tsx](../web/src/pages/Bookmark.tsx) |
| Invalid schemes and Markdown delimiters could produce unusable captures or unintended link formatting. | HTTP(S) validation, normalized destinations and escaped title text share one serializer. | [bookmark.ts](../web/src/lib/bookmark.ts) |
| Failed autosave discarded supplied tags; clipboard rejection lacked feedback. | Failed autosave returns to an editable draft with tags retained; failed copy reports an error. | [Bookmark.tsx](../web/src/pages/Bookmark.tsx) |
| Regex duplicate extraction could invent a truncated URL from balanced parentheses, causing a genuinely different URL to be silently skipped. | Existing Markdown/GFM parser extracts links and resolved references; regression covers balanced and distinct destinations. | [useBookmarkImport.ts](../web/src/components/BookmarksImport/useBookmarkImport.ts) |
| Failed dedupe could continue creating duplicates; repeated file rows and stale asynchronous runs were insufficiently isolated. | Scan failure stops creation; per-run cancellation and identity guards prevent stale state publication; same-file duplicates are skipped. | [useBookmarkImport.ts](../web/src/components/BookmarksImport/useBookmarkImport.ts) |
| Replacement file reads could restore an old preview after a later selection or dialog close. | Read-generation guard discards stale results; new reads clear old rows; failed reads expose errors. | [BookmarksImportDialog.tsx](../web/src/components/BookmarksImport/BookmarksImportDialog.tsx) |
| Oversized exports could impose unbounded file-reading and parsing work; unterminated CSV quotes were silently tolerated. | Reject files above 10 MiB before reading; unterminated quoted fields fail explicitly. | [dialog](../web/src/components/BookmarksImport/BookmarksImportDialog.tsx), [csv.ts](../web/src/components/BookmarksImport/csv.ts) |
| Refresh could continue after navigation, lose partial totals or leave persisted covers absent from the visible cache after an error. | Abort controller, unmount cleanup, run guard, explicit cancellation and final invalidation on every exit. | [useBookmarkCoverRefresh.ts](../web/src/hooks/useBookmarkCoverRefresh.ts) |
| Refresh persistence failures could be reported as successful cover updates; concurrent author edits could be overwritten by old payload snapshots. | Counters publish after persistence; real storage failures propagate; expected content and raw payload guard refresh and runner writes across all three drivers. | [enrichment](../server/router/api/v1/memo_service_link_enrichment.go), [runner](../server/runner/memopayload/runner.go), [store](../store/memo.go) |
| Invalid page tokens could fall back silently, and cancellation could schedule unnecessary work or mutate retry state. | Strict token validation, bounded error-group workers and context checks preserve cancellation semantics. | [enrichment](../server/router/api/v1/memo_service_link_enrichment.go) |
| Retry failures after a reset could lack a first-attempt timestamp, undermining the retry window. | Failure recording initializes the window when absent. | [enrichment](../server/router/api/v1/memo_service_link_enrichment.go) |
| Oversized image bodies were truncated and treated as usable; some non-public IPv4 ranges passed the prior address classification. | Read one byte beyond the size limit and reject overflow; reject non-global/private addresses plus selected shared, benchmarking and reserved ranges. | [html_meta.go](../internal/httpgetter/html_meta.go) |

The three findings from the independent frontend review—Space placement, capture draft restoration and false-positive import dedupe—were re-read in the final source and are resolved there. This source verification is separate from the test evidence below.

## UI and UX assessment

The primary journey is understandable: Save Link opens a labeled URL field, Continue opens the established editor, and saving returns to the memo collection. Import and cover maintenance remain secondary actions. Reusing the editor avoids a second set of visibility, attachment and save controls. The tradeoff is that a simple capture loads the existing editor surface and its bundle cost.

The masthead follows semantic color tokens and provides accessible names for mobile icon actions. The design contract specifies 40px mobile targets. Import supports keyboard activation, the file picker and drag-and-drop. Error text is explicit; progress has a named progressbar and a polite live region. Cancellation distinguishes stopping from stopped and preserves completed work. Cover refresh reports success, partial failures, errors and cancellation separately.

Bento retains its aspect-driven layout and shared spacing. The cover and text variants expose a single full-card navigation button with visible focus styling; decorative covers have empty alternative text. Failed covers fall back to readable text. The card opens the saved memo rather than directly launching the external site, keeping notes and memo actions discoverable. Source labels and titles help users recognize the destination.

Remaining UX limits are operationally meaningful: importing is foreground work, duplicate detection is user-wide even while importing into a Space, and the refresh command works across all the user's bookmarks rather than only the current filtered collection. The refresh scope explanation should remain attached to the action. Import completion can include failed rows; a completed run must not be interpreted as every row having succeeded. A retry starts another scan rather than resuming a durable job.

Browser checks supplied by the coordinating agent cover 375px, 768px and 1280px widths and the journeys listed below. These checks do not establish complete WCAG conformance, every theme, every translation, every screen-reader combination or 200% browser zoom. Live-region markup is necessary evidence, not proof that all announcements were heard in assistive technology.

## Verification evidence and remaining checks

The following checks completed on the working tree during this audit. An initial highly parallel frontend run was interrupted after machine saturation caused timeouts; the complete rerun with two workers passed without increasing test timeouts.

| Check | Evidence/status |
| --- | --- |
| Capture regression suite | 17 tests passed, reported by capture implementation agent; includes selected Space and real editor-initialization/cache behavior for restored annotations and attachments. |
| Import hook suite | 15 tests passed, reported by import implementation agent; false-positive destination and reference-link tests were observed failing before the fix and passing afterward. |
| Import dialog suite | 8 tests passed, reported by coordinating agent. |
| Frontend lint and production build | `pnpm lint` passed (613 files); `pnpm build` passed. Existing bundle-size warnings remain. |
| Full frontend unit suite | `pnpm test --maxWorkers 2`: 152 files, 1,205 tests passed. Latest six bookmark suites also passed, 59 tests total. |
| SQLite store and payload runner with race detector | `DRIVER=sqlite go test -race ./store/... ./server/runner/...` passed, including real SQLite integration tests and the concurrent-edit regression. A negative-control overlay without the guard reproduced lost updates. |
| Full internal/server race suites | `GOMAXPROCS=2 go test -p 2 -race ./internal/... ./server/...` passed, including API integration and file-serving tests. |
| MySQL/PostgreSQL integration | Not run: Docker is unavailable in the local environment. Source changes cover both drivers, but SQLite results do not substitute for their integration tests. |
| Browser: ordinary capture | Pasted URL, continued to editor, saved and observed bookmark collection. |
| Browser: import | Four input rows produced two created, two skipped and zero failed. |
| Browser: draft persistence | Annotation survived reload. Attachment restoration is covered by the capture regression; no separate browser attachment-reload result is claimed here. |
| Browser: Space autosave | Saved bookmark retained Space placement. |
| Browser: bento navigation | Full-card click opened memo detail. |
| Browser: cached cover | A real GitHub bookmark fetched and displayed its locally cached 2,560 × 1,280 cover; text-only cards remained usable alongside it. |
| Browser: invalid capture | `javascript:` URL with `autosave=1` showed validation feedback and the editable URL form. |
| Browser: responsive layout | Inspected at 375, 768 and 1280px widths. |
| Rebuilt local API | Malformed refresh token returned HTTP 400; page size 2 examined two memos and returned token `2`; anonymous refresh returned HTTP 401. |
| Formatting and diagnostics | `git diff --check`, Go formatting, TypeScript and Biome passed. LSP fresh-diagnostic requests timed out; `gopls` and `golangci-lint` were not installed. No LSP success is claimed. |
| Independent engineering gate | PASS: reviewed capture/import lifecycles, conditional writes in all drivers, runner, tests, report and representative final screenshots. No new regression blocker found. |
| Independent visual gate | PASS on all ten final JPEG captures, with no blocking clipping, overflow or readability issue. Confidence is high for visible layout and medium for overall accessibility; dark theme, 200% zoom and screen-reader behavior are not certified by this pass. |

Browser artifacts are recorded under `/private/tmp/bookmarks-qa-evidence`. These are local, temporary artifacts and should be copied to durable release evidence if needed. The valid review set is the ten `final-*.jpg` images, captured with `fullPage: false` after viewport settling. File signatures and dimensions were verified: 375 × 812, 768 × 900, and 1280 × 900. Earlier `.png` files contained JPEG bytes and some premature/full-page captures scaled incorrectly; they are excluded from review. No Lighthouse score was measured. These browser scenarios ran against the local development frontend and an isolated rebuilt Go server, not a deployed production environment.

Relevant final commands are `cd web && pnpm lint`, `cd web && pnpm test`, `cd web && pnpm build`, `go test -v -race ./server/...`, `go test -v -race ./internal/...` and `go test -v ./store/...`. The store command requires the external database test environment for full driver coverage.

## Residual readiness limits

| Limit | Consequence and follow-up condition |
| --- | --- |
| Standalone cached covers remain owner-only under existing attachment authorization. | Public and Space readers may receive cover failures and text fallbacks. Shared-cover parity requires an explicit authorization/design decision; this pass does not loosen attachment access. |
| No cover-orphan garbage collection. | Removed links, failed association/persistence and stale snapshots can leave unused cover attachments or blobs. Track storage growth; add safe reference-aware collection before storage churn becomes material. |
| Refresh only repairs missing cover UIDs. | An entry pointing to a deleted, broken or stale cached cover is skipped. A comprehensive repair command would need existence/content validation and defined replacement semantics. |
| OFFSET pagination is not a snapshot. | Concurrent inserts or deletions can shift import-scan and refresh pages, causing omissions or repeat examination. Large or heavily edited libraries need a stable cursor/snapshot design. |
| Foreground import has no durable resume. | Navigation stops further scheduling; in-flight writes may finish. Reimport scans again. Use a persisted background job only when unattended or very large imports become a supported requirement. |
| CSV input is capped at 10 MiB and parsed on the main thread. | This bounds input size, not responsiveness on every device. Larger exports require splitting; no large-file performance guarantee was measured. |
| Metadata is limited to the first five extracted links. | Later links remain in memo content but do not all receive cached metadata. This is an existing bounded-enrichment policy. |
| Worker limits are per request, not global. | Several users or concurrent refresh requests can multiply outbound downloads and storage work. No global cover-download admission limit or load-test capacity figure is established. |
| URL-bearing logs remain. | Failed metadata/image fetches and import rows can expose full URLs, including sensitive query strings, to log readers. Review redaction and retention for deployments handling private links. |
| Large initial application/editor bundles remain. | Build success does not establish fast cold starts. Existing bundle costs require measured route-load work if capture latency is a deployment concern; no Lighthouse score is claimed. |
| Database integration evidence is incomplete. | Conditional update behavior is implemented in SQLite, MySQL and PostgreSQL, but only local SQLite execution was available. Run all driver suites before claiming cross-database release validation. |

These are explicit boundaries of the current implementation and evidence. They should remain visible in release decisions rather than being hidden by a blanket production-ready label.

## External research used

- Markdown titles, destinations, balanced delimiters and reference links have defined parsing rules; using the installed parser avoids maintaining a partial regex interpretation. [CommonMark specification](https://spec.commonmark.org/spec).
- Status feedback should be programmatically identifiable without forcing focus changes. The live regions and named progressbar were reviewed against that principle; no complete assistive-technology audit is implied. [W3C: Understanding status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html).
- Shared address space and benchmarking ranges are special-purpose allocations, so a generic global-unicast predicate alone is insufficient evidence of a safe public destination. The fetcher hardening addresses the specific ranges identified in this pass, not every possible network-policy environment. [IANA IPv4 special-purpose registry](https://www.iana.org/assignments/iana-ipv4-special-registry/iana-ipv4-special-registry.xhtml).
