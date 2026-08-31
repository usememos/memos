# Bookmark Manager Upgrade Plan (Raindrop/Instapaper parity)

> **Status: Phases 1–3 implemented.** Phase 4 remains deferred.
> Deviations from the original plan: enrichment lives in `server/router/api/v1/memo_service_link_enrichment.go`
> (not `server/runner/memopayload`) to avoid an import cycle — the backfill Runner receives the
> enrich func by injection; cover URL is `/file/attachments/{uid}` (filename segment optional);
> the backfill Runner additionally skips memos without `has_link` and skips unchanged payloads so
> steady-state boots do no writes.

Goal: make memos a real bookmark manager. Save URL → persisted title/description/cover image, quick capture, read/unread, search-ready.

## Current state (verified in code)

| Concern | Today | Gap |
|---|---|---|
| Link metadata | `GetLinkMetadata`/`BatchGetLinkMetadata` (`server/router/api/v1/memo_service_link_metadata.go`) fetch og:title/desc/image live via SSRF-safe `httpgetter.HTMLMetaFetcher`; frontend caches 24h (`useMemoQueries.ts:173`) | Not persisted — page dies → blank card; titles unsearchable; every client refetches |
| Cover images | `og:image` hotlinked from origin | No local copy — hotlink blocks / link rot kills images |
| Payload | `MemoPayload.Property` has only `has_link` bool (`proto/store/memo.proto`); rebuilt by `RebuildMemoPayload` at `memo_create_helpers.go:72` + `memo_service.go:390` | No place to store metadata |
| Link card | `LinkMetadataCard.tsx` renders when paragraph is a single link (`Paragraph.tsx:62`); falls back to plain text on fetch failure | Falls back to nothing when page is dead |
| Collections | Spaces + tags | Fine as-is |
| Capture | Manual: open app, paste URL | No bookmarklet/share target |
| Read/unread | Nothing | Missing |

Attachment infra is solid and reusable: LOCAL/S3 storage via `saveAttachmentBlobWithInstanceStorageSetting` (`attachment_service_storage.go:58`), thumbnails (`?thumbnail=true`), serving `/file/{name}/{filename}`, share-token links. `store.CreateAttachment` usable server-side without the HTTP service layer.

## Phase 1 — Persist metadata + cover images (core, everything builds on this)

### Proto
1. `proto/store/memo.proto` — add to `MemoPayload`:
   ```proto
   repeated LinkMetadata links = 4;
   message LinkMetadata {
     string url = 1;
     string title = 2;
     string description = 3;
     string image = 4;               // original og:image URL (fallback)
     string cover_attachment_uid = 5; // locally cached cover (attachment name)
   }
   ```
   Top-level on `MemoPayload`, not `Property` — `Property` stays purely calculated, enrichment is a separate write step. No DB migration: payload is a proto blob column in all three drivers.
2. `proto/api/v1/memo_service.proto` — mirror on `Memo.Property`: `repeated LinkMetadata links = 6` (OUTPUT_ONLY) + message. Map in `convertMemoPropertyFromStore` (`memo_service_converter.go:364`).
3. `cd proto && buf generate && buf lint`.

### Extraction
4. `internal/markdown` — `ExtractAll` walker already visits `KindLink`/`KindAutoLink` (`markdown.go:445`); collect unique http(s) destinations into `ExtractedData.Links []string`.

### Enrichment (new)
5. `server/runner/memopayload/` — new `EnrichMemoLinks(ctx, deps, memo)`:
   - For each extracted URL (cap at 5 links per memo to bound latency): reuse existing payload entry if URL matches (no refetch storm on edit).
   - Else `HTMLMetaFetcher.Get` → build entry.
   - Cover: download image with new `HTMLMetaFetcher.GetImage` method (reuse its SSRF-safe client + `ErrInternalIP` checks, unlike bare `httpgetter.GetImage` which is plain `http.Get`; cap ~5 MiB via `io.LimitReader`).
   - Dedup: filename `link-cover-{sha1(url)}.{ext}`, lookup by `Filename` + `CreatorID` via `FindAttachment`; create standalone attachment (CreatorID = memo creator, no `MemoID` binding so covers don't appear in the memo's attachment grid — they will show in the attachment library; deletion doesn't cascade, shared URLs dedup to one file).
   - Storage: reuse blob-save logic; helper currently lives in `server/router/api/v1/attachment_service_storage.go` (package `v1`) — extract minimal save path into `internal/storage` or duplicate the ~40-line wrapper there. Prefer extraction.
   - Any step fails → keep old entry or skip. Never fail the memo create/update. Bound whole enrichment with a context timeout (fetcher already has semaphore + singleflight).
6. Wire after `RebuildMemoPayload`:
   - create: in `prepareMemoCreate` (`memo_create_helpers.go:72`) — `memo.CreatorID` is already set there (line 41), enrichment runs before DB insert.
   - update: inside the `path == "content"` branch (`memo_service.go:390`), after rebuild, before `update.Payload = nextMemo.Payload`.
   `s.linkMetadataFetcher` already on `APIV1Service`.
7. Backfill: extend `memopayload.Runner.RunOnce` to enrich (pass fetcher + storage deps into `Runner`). Runner currently has no caller — wire one-shot goroutine in `Server.Start()` (`server/server.go:104`, after listener up).

### Frontend
8. Regenerated types land in `web/src/types/proto/`.
9. `LinkMetadataCard`: accept optional `stored` metadata prop. Render priority: live fetch → stored → fallback text. Image priority: `/file/attachments/{cover_attachment_uid}/cover.jpg` (route confirmed: `fileserver/README.md` `GET /file/attachments/:uid[/:filename]`; thumbnails via `?thumbnail=true`) → stored `image` URL → live.
10. Thread memo's stored links down: `Paragraph.tsx` gets URL only. `MarkdownRenderContext` exists but carries only `blockDepth` — extend its value with a `linkMetadata` map populated from `MemoContent` (which holds the memo).
11. `cd web && pnpm lint && pnpm test`.

### Tests (Phase 1 gate)
- `internal/markdown`: link-destination extraction cases (markdown link, autolink, bare URL linkified, dupes deduped, mailto excluded).
- `server/runner/memopayload`: `EnrichMemoLinks` with fake fetcher + in-memory store — new entry, reuse-on-edit, image failure tolerated, cover dedup.
- Run: `go test -v -race ./internal/... ./server/...` (server group), plus store group untouched.

## Phase 2 — Quick capture

12. Bookmarklet (docs/settings snippet):    ```js
    javascript:location.href='https://HOST/bookmark?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)
    ```
13. SPA route `/bookmark` (`web/src/router`): auth-guarded; prefills editor with `[title](url)`, focuses; `&autosave=1` submits immediately and closes (for the bookmarklet flow where you never want to see the app). Note: `MemoEditorProps` (`web/src/components/MemoEditor/types/components.ts`) has no `initialContent` prop — add one (`initialContent?: string`, seeds editor state the same way edit mode seeds from `memo.content`).
14. Optional polish: pasting a bare URL into an empty editor auto-embeds as link block once metadata resolves.

Gate: `cd web && pnpm lint && pnpm test`; manual dev-server walkthrough (`pnpm dev` + `go run ./cmd/memos --port 8081`).

## Phase 3 — Read/unread

15. Capture adds `#unread` (bookmarklet route appends tag; `&tags=` param override).
16. "Unread" saved filter in sidebar = existing tag filter (`MemoFilterContext` already supports tag filters; sidebar shortcut only).
17. Memo action menu: "Mark as read" → removes `#unread` via existing tag-mutation path (memo update rebuild already handles tag changes).

Gate: web lint+test; server untouched.

## Phase 4 — Deferred (only if need is real after 1–3)

- Title search across bookmarks: payload links are proto blob → driver-level search or denormalized column = schema change ×3 drivers + `LATEST.sql`. Defer.
- Broken-link checker: scheduled HEAD checks flagging entries.
- Reader mode (server-side readability extraction — heavy dep).
- Highlights/annotations (new proto + editor surface).
- Cover cache GC for orphaned `link-cover-*` attachments.

## Decisions & ceilings

- Covers are standalone user attachments: visible in attachment library, no cascade delete on memo delete, deduped per URL+creator. Ceiling documented with `ponytail:` comment; GC tooling later if storage becomes a problem.
- Cover access: fileserver serves unlinked attachments to creator/admin only (`fileserver/README.md` Authorization); SPA `<img>` requests authenticate via the refresh-token cookie, so the creator sees covers fine. Public share pages render stored title/description (memo payload travels with the share) but covers degrade to the stored `og:image` URL — `share_token` only grants access to memo-linked attachments. Accepted.
- Enrichment is synchronous within create/update, timeout-bounded (~10s). Slow pages delay memo save by at most the timeout; metadata failure never blocks.
- `GetLinkMetadata` stays public-ACL (`acl_config.go:39-40`) — enrichment runs server-side internally, no ACL change.
- No new dependencies.
