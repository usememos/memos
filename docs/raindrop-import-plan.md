# Raindrop Bookmark Import

Status: Implemented (all phases; Phase 2 deferred items remain out of scope)

> Review pass (full RFC-4180 parse of the sample): row count corrected 1270 → 879
> (1270 was physical lines; multiline quoted fields inflate line counts), folders ~20 →
> 16, and 0/879 rows lack URL or title. Verified against code: tag parser accepts `-`
> inside tags (parser/tag.go `isSegmentStarter`), `listMemos` accepts an arbitrary filter
> string (useMemoQueries.ts:131), `ui/dialog.tsx` exists (no progress component — inline
> bar), and no client-side link extractor exists, so the dedupe regex is now specified
> inline instead of referencing a phantom "editor link regex".

## Goal

Import a Raindrop.io CSV export (`49eef517-8ba9-469c-9d6a-480f363945b8.csv`, 879 rows)
into memos as link memos that appear on the `/bookmarks` tab. Web-only feature; no
server, proto, or DB changes, no new dependencies.

## Sample data (verified from the export)

| Field | Coverage | Disposition |
| --- | --- | --- |
| `url` | 100% | memo content, markdown link |
| `title` | ~100% | markdown link text |
| `note` | 129 rows | appended under the link as plain text |
| `excerpt` | some | **dropped** — server og:description covers it in the metadata card |
| `folder` | 16 collections (Spanish, spaces, unicode) | slugified tag (`#recursos-de-programacion`) |
| `tags` | comma-separated, e.g. `dev`, `ai`, `filosofía` | appended as `#tag` verbatim (unicode tags supported by the server tag parser) |
| `created` | ISO timestamps | **dropped** — `display_time` is `reserved` in `proto/api/v1/memo_service.proto:232`; imported memos get import-time order. Ceiling, needs an API change to fix |
| `cover` | 569 rows | **dropped** — `EnrichMemoLinks` fetches+stores og covers automatically on create (`memo_create_helpers.go:75`), so covers still appear; Raindrop URLs not reused |
| `favorite` | all `false` | dropped |
| `highlights` | 5 rows | appended to note text |

Also verified: CSV contains quoted fields with embedded commas **and newlines**
(folder column leaks sentence fragments under naive splitting — a line-split "count"
reports 1270 physical lines where the real parse yields 879 rows) — the parser must be a
real RFC-4180-style state machine, not `split(",")`. Re-checked with a full state
machine: 0 rows lack a URL, 0 lack a title; the `title || url` fallback below stays as
belt-and-braces.

## Design

### Content shape per row

```
[title](url)
#folder-slug #tag1 #tag2

note text
```

- One memo per row. `has_link` property derives server-side from the URL
  (`RebuildMemoPayload` on create), so imported memos land on `/bookmarks` with zero
  filter work. Link text falls back to the URL when a title is empty.
- Visibility: leave unset → server default (PRIVATE). No `#unread` tag — hundreds of unread
  badges would be noise; these are settled archives, not a reading queue.
- Enrichment (`og:title`, cover caching) runs synchronously per create inside the
  server's 10s `enrichTimeout`. At ~900 rows this dominates import time.

### Dedupe

Before importing, fetch the user's link memos once (`has_link` filter, paged via the
existing `listMemos` request passthrough in `useMemoQueries.ts:131`), extract URLs from
content with a local markdown-link regex `\/\]\((https?:\/\/[^)\s]+)\)/g` (no shared
client-side link extractor exists — the Go one is server-only), build a `Set`. Rows whose
URL already exists are skipped and counted. Re-running the import is therefore safe.

### Import loop

- Sequential-ish: fixed concurrency of 3 via a small worker pool over the row queue.
  879 creates × ~1-2s enrichment ÷ 3 ≈ 5-15 min. Acceptable for a one-shot import.
- Per-row failure (400/5xx) is counted and logged to an in-dialog error list; the run
  continues. Cancel button stops dispatching new rows.
- Progress UI: `created / skipped / failed / total` counters + row pointer.
- Uses the existing `useCreateMemo` mutation core (call `memoServiceClient.createMemo`
  directly in the loop to avoid ~900 React Query invalidations; invalidate lists once
  at the end).

### UI surface

"Import" button in the `/bookmarks` page header (next to "Save a link") opening a
Dialog:

1. File picker (accept `.csv`) or drag-drop → parse client-side.
2. Preview step: total rows, folders→tags mapping table, sample of parsed rows.
3. Import step: progress + cancel.
4. Summary: counters + "Done".

Progress bar: plain inline `div` with a width percentage — `web/src/components/ui/` has
`dialog.tsx` but no progress component; don't add one for this.

Components: `web/src/components/BookmarksImport/` (`BookmarksImportDialog.tsx`,
`useBookmarkImport.ts`, `csv.ts`, `slugifyTag.ts`).

### CSV parser

Hand-rolled state machine (~40 lines, no new dep — papaparse not in `package.json` and
AGENTS.md says ask before adding): handles double quotes, doubled quotes (`""`),
embedded commas/newlines/CRLF, trailing newline. Unit-tested against the real sample's
nasty rows (multiline quoted folder values).

### Tag slug rule (folders)

Lowercase; keep unicode letters+digits (server tag parser is unicode-aware and accepts
`-`/`+`/`&` inside tags — `isSegmentStarter`/`isSegmentContinuation` in
`internal/markdown/parser/tag.go`, so `#recursos-de-programacion` stays one tag); runs of
anything else → `-`; trim `-`. Empty result or `unsorted` folder → no folder tag.

## Files

| File | Change |
| --- | --- |
| `web/src/components/BookmarksImport/csv.ts` | RFC-4180 parser, `parseCsv(text): string[][]` |
| `web/src/components/BookmarksImport/slugifyTag.ts` | folder → tag slug |
| `web/src/components/BookmarksImport/useBookmarkImport.ts` | dedupe fetch, worker-pool create loop, progress state |
| `web/src/components/BookmarksImport/BookmarksImportDialog.tsx` | Dialog UI: pick → preview → import → summary |
| `web/src/pages/Bookmarks.tsx` | header "Import" button |
| `web/src/locales/en.json` | `bookmarks.import*` keys |
| `web/tests/bookmarks-import-csv.test.ts` | parser: quoted commas, embedded newlines, `""` escapes, CRLF, real sample fixture rows |
| `web/tests/bookmarks-import.test.tsx` | loop: dedupe skip, content shape, error tally, folder slug, tags passthrough |

## Phases

1. Parser + slugify + tests (pure logic, first).
2. Import loop hook + tests (mocked client).
3. Dialog UI + Bookmarks page wiring + i18n + gates (`pnpm lint && pnpm test && pnpm build`).

## Deferred (Phase 2+, needs server work)

- `created` date preservation — requires un-reserving a time field on CreateMemo.
- Reusing Raindrop `cover` URLs — requires client-settable payload links.
- Highlight → separate annotation memos.

## Risks

- 879 sequential enrichments hammer external sites' og endpoints; concurrency capped at
  3 and failures are non-fatal (EnrichMemoLinks already skips dead links).
- Import session lost on tab close — no resumability. One-shot; dedupe makes re-running
  cheap. ponytail: checkpoint file if users complain.
