# Bookmarks plan review

Date: 2026-09-06. Original verdict: **ITERATE before implementation**. Follow-up: **the four required plan revisions are addressed**, as recorded below; implementation and its approval gates remain outstanding.

Originally reviewed [implementation plan](2026-09-06-bookmarks-production-readiness.md), SHA-256 `e5e2d8c21fcb58394f0fd14e8c8e7b1cd3bff2dd65225f7519aa5bbb266a1c7c`, against the audit and current source. This is a design/executability review, not a runtime verification of future changes. The findings below describe that original revision; the follow-up records their resolution.

## Required revisions

### 1. [P1] Give repair candidates unique storage objects before publication

**Plan location:** task 4, lines 138–150.

The plan promises that failed replacement retains the previous cover, but creating a new attachment UID does not ensure a new S3 object. `cacheLinkCover` derives the filename from page/image URLs. `saveAttachmentBlobWithInstanceStorageSetting` derives the S3 key from the configured path template and filename, and `internal/storage/s3/s3.go:UploadObject` performs a PutObject to that exact key. With a filename-only template and the same source image URL, repair can overwrite the old object before its attachment row and memo CAS succeed. Other memos sharing that object observe the replacement even if publication fails.

**Required change:** specify immutable, unique object keys for replacement candidates, including custom path templates without UUID placeholders. Preserve the old object until after successful publication and later safe collection. Add an S3 regression with a filename-only template, two memos sharing a cover, and injected attachment-create/CAS failures; the old key and bytes must remain unchanged. Reuse existing uniqueness handling where it actually covers the storage backend.

**Evidence:** `server/router/api/v1/memo_service_link_enrichment.go:381`, `server/router/api/v1/attachment_service_storage.go:109`, `internal/storage/s3/s3.go:143`.

### 2. [P1] Specify bounded image validation beyond readable dimensions

**Plan location:** task 4, line 137.

The proposed existing decoder is `decodeImageBounds`, which calls `image.DecodeConfig`. This reads configuration, not the complete image pixels. A file with a valid header and a damaged/truncated body can pass the proposed health check and remain skipped, contradicting the corrupt-cover repair acceptance criterion. Newly fetched candidates also need validation before being published.

Simply switching to unrestricted full decoding is insufficient: the proposed storage reader uses `io.ReadAll` for local files and S3 objects, and compressed image size does not bound decoded pixel memory. The new repair path would exercise this across every cached cover with ten workers per request.

**Required change:** define supported formats, byte and pixel bounds, complete-decode validation within those bounds, and failure behavior for unsupported formats. Use bounded storage reads and explicit probe/decode admission. Test a valid header with truncated pixels, excessive dimensions, oversized stored data, cancellation, and a corrupt replacement candidate. Retain the old reference and report failure if a replacement cannot be validated.

**Evidence:** `server/router/api/v1/memo_service_link_enrichment.go:102`, `server/router/api/v1/attachment_service_storage.go:207`, `internal/storage/s3/s3.go:157`.

### 3. [P2] Resolve archived-memo dedupe before promising account-wide skipping

**Plan location:** task 6, line 197; task 5's import contract.

The planned copy says “Links already saved anywhere in your account are skipped.” However, `collectExistingUrls` omits `state`, and `ListMemos` defaults every non-ARCHIVED request to NORMAL. A link that exists only in an archived memo will be imported again. Changing ordering to `id asc` will not change this behavior. The plan currently has no explicit lifecycle decision or regression for it.

**Required change:** choose and document the lifecycle contract. To fulfill the proposed broad copy, scan NORMAL and ARCHIVED separately, using independent cursors and combining their URL sets before any creation; failure in either scan must stop writes. Alternatively, retain normal-only dedupe and make that exclusion explicit in copy, acceptance criteria and the audit. Test a URL present only in archive and the same URL across normal/archive and different Spaces.

**Evidence:** `web/src/components/BookmarksImport/useBookmarkImport.ts:32`, `server/router/api/v1/memo_service.go:92`.

### 4. [P2] Complete the cursor contract for mixed orders and lifecycle state

**Plan location:** task 5, lines 163–178.

The current order parser accepts comma-separated fields, and drivers prepend pinned/time ordering. A new ID cursor cannot safely coexist with those orderings. For example, with `pinned, id asc`, an early pinned memo with a large ID advances the cursor past lower-ID unpinned memos. The plan does not explicitly reject mixed ordering or require the ID branch to replace all existing ORDER BY terms. Its token input list also omits lifecycle state, which is a separate ListMemos request field.

**Required change:** accept only the exact supported standalone scan order (reject `pinned, id asc`, `id asc, update_time`, and unsupported directions); make the driver order exclusively ID ascending for that mode. Bind tokens to lifecycle state and caller identity as well as filter/scope/order. Specify how the maximum-ID fence is obtained without loading the whole library and ensure the cursor advances from the last returned row, not the extra lookahead row. Add API-level tests for mixed orders, changed state, tied timestamps and lookahead boundaries in addition to the store insert/delete test.

**Evidence:** `server/router/api/v1/memo_service_query.go:11`, `store/db/sqlite/memo.go:177` and equivalent MySQL/PostgreSQL order construction, `server/router/api/v1/memo_service.go:92`.

## Remaining task assessment

| Task | Assessment |
| --- | --- |
| 1: database evidence | Appropriate real-engine gate; explicit per-driver race commands avoid relying on child-process flag propagation. |
| 2: log privacy | Sound scope and useful synthetic secret test; trace wrapped errors, not only URL fields. |
| 3: download admission | Existing service constructs one fetcher; proposed semaphore fits that lifetime. It bounds image HTTP work, not storage reads or full decoding introduced by task 4. |
| 4: repair | Blocked by findings 1–2. Also include `memo_service_link_metadata.go` and fetcher test doubles when adding `GetFresh` to the service-facing interface. |
| 5: stable scans | Viable after finding 4; correctly avoids claiming a content snapshot or exactly-once imports. |
| 6: UX/performance | Useful browser matrix and measurement-first approach; fix finding 3. Screen-reader execution remains required evidence, not an inference from markup. |
| 7: shared covers | Permission reuse and separate approval gate are appropriate. Explicitly include `web/src/components/MemoContent/LinkMetadataCard.tsx`: it currently lacks memo identity and uses the standalone URL, so the caller chain must supply memo identity/share context. Verify no-store survives existing serving helpers. |
| 8: storage lifecycle | Appropriate staged inventory and deletion design. Keep inventory/procedure mandatory where the minimum-release paragraph requires storage measurements; automatic deletion remains deferred. |
| 9: release evidence | Appropriate final-source qualification. Add the new repair failure cases and cursor contract tests to the gate after revision. |

## Coverage and limits

All eleven residual audit limits have a mapped response. The plan appropriately preserves the existing editor, memo authorization model and bounded foreground import, and avoids adding a speculative job system. It is not yet execution-ready because tasks 4–6 contain the concrete gaps above.

Review performed by reading the full plan and audit limits, tracing the implicated storage/fetch/query/UI paths, and checking existing test contracts. No application code was changed and no backend/browser test run is claimed. Re-review the revised task 4–6 contracts and their file maps before approving execution.

## Follow-up review: revised plan

Reviewed revision SHA-256 `e0e445475239b417f3df9451f07ca0e580d121eb6fb911c700b045af52fd0965` on 2026-09-06. The four findings are **resolved at the plan level**:

| Finding | Revised contract and required evidence |
| --- | --- |
| 1: replacement object isolation | Task 4 separates physical keys from logical filenames, appends a fresh candidate UID after template expansion, preserves old objects, and requires Local/S3 failure tests including filename-only templates and shared covers. |
| 2: image integrity/resource bounds | Task 4 specifies 5 MiB bounded streaming/blob reads, 4096-axis/8-million-pixel preflight limits, full static-image decode, explicit unsupported-format behavior, and two service-wide validation permits. It acknowledges that synchronous decode cannot be interrupted mid-call. |
| 3: archived dedupe | Task 5 explicitly scans NORMAL and ARCHIVED with independent cursors before any creates; either scan failing stops writes. Task 6's copy depends on that behavior. Lifecycle transitions during scans remain a documented concurrency limitation. |
| 4: cursor semantics | Task 5 rejects mixed/unsupported ID orders, makes ID ordering exclusive, binds tokens to effective state/caller/query/page size, obtains a one-row descending fence, and advances past the last emitted row rather than lookahead. API and driver boundary tests are specified. |

Additional review notes are addressed: the fetcher interface/test doubles are in task 4's file map; task 7 names the flow-card context chain and final no-store header checks; task 8's inventory is explicitly required for minimum release; task 9 includes the added regression boundaries.

Validation: rechecked the storage streaming interface, legacy blob query shape, service constructor and Markdown context consumers against source; checked consistency of proposed fields/interfaces and ran `rtk proxy git diff --check` successfully. No production code was changed or tested by this revision. The required implementation tests are still unchecked, and this follow-up does not grant authorization for task 7 or destructive cleanup.
