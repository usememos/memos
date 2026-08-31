# Bookmarks Tab Plan

Status: Implemented (Phase 1 MVP; Phase 2 optional polish deferred)

> Review note: the original draft claimed the bookmarks route needs no sidebar wiring —
> wrong. `RouteSidebarContent` (AppSidebar.tsx:282-293) returns `null` for unmatched
> kinds, so `/bookmarks` would render an **empty sidebar** (no Spaces/Tags). It must join
> the `CollectionSidebarContent` group, like Archived. Also verified: `property.hasLink`
> has a `FILTER_CONFIGS` entry (LinkIcon + `memo.filters.has-link`), so the zero-code
> `/?filter=property.hasLink:true` alternative renders a proper chip too.

Goal: add a dedicated **Bookmarks** sidebar tab — a sibling of the `#unread` shortcut and
the Attachments nav row — opening a page that lists **link/bookmark memos only**.
No backend work: the `has_link` CEL filter already exists end to end.

## Verified building blocks (all in tree today)

| Piece | Where | Evidence |
| --- | --- | --- |
| Server-side filter | `internal/filter/schema.go` exposes `has_link`; exercised in `store/test/memo_filter_test.go` (`ListWithFilter("has_link")`, `has_link && has_code`) | grep hits in both |
| Client CEL builder | `web/src/hooks/useMemoFilters.ts:77-78` — `property.hasLink` factor → `has_link`; `FilterFactor` union includes it (`MemoFilterContext.tsx:11`) | read |
| Feed page template | `web/src/pages/Archived.tsx` — thin `PagedMemoList` wrapper with `renderLeading` header; Bookmarks copies this shape with `contextFilter` carrying `has_link` (PagedMemoList combines context+page filters via `combineCELFilters`) | read |
| Route registration slot | `web/src/router/index.tsx:104-115` — auth + full-init guarded block already hosting `ATTACHMENTS`, `BOOKMARK`, `INBOX`, `SETTING` | read |
| Sidebar nav row | `web/src/components/AppSidebar/AppSidebar.tsx` `items` array (`#unread` at ~380, Attachments at ~387) — id/label/path/icon/active pattern | read |
| Route-kind plumbing | `web/src/components/AppSidebar/routes.ts` — `getSidebarRouteKind`, `routeSupportsCollectionScope`, `getRouteActionPolicy`; each tested in `tests/app-sidebar-routes.test.ts` | read |
| Router config tests | `tests/router-config.test.tsx:56,62` enumerate guarded routes | read |
| Cover tiles | Bento `variant="bento"` + `MemoView/bentoCover.ts` render stored link covers — Bookmarks page inherits via `PagedMemoList` renderer options | implemented this session |

## Chosen design

### Zero-code alternative (rejected as the deliverable, noted for honesty)

`#unread` is just `/?filter=tagSearch:unread`. The same trick already works today:
`/?filter=property.hasLink:true` (factor exists in `FilterFactor`). It gives no dedicated
empty state, no header, and no home for future bookmark-manager features — hence a real
page, which is also what "like the attachments one" asks for.

### Route + page (Phase 1 — MVP)

- `ROUTES.BOOKMARKS = "/bookmarks"` in `web/src/router/routes.ts` (plural; singular
  `/bookmark` stays the capture endpoint).
- `web/src/pages/Bookmarks.tsx`, registered in the auth + full-init block of
  `router/index.tsx`. Copy of `Archived.tsx`:
  - `contextFilter={combineCELFilters("has_link", memoFilter)}` where `memoFilter` is
    `useSpaceContext().memoFilter` (exactly how Home threads the remembered Space scope at
    `Home.tsx:22`); `state: State.NORMAL`, default `orderBy`.
  - `renderLeading` header: `BookmarkIcon` + `t("common.bookmarks")` title, with
    a "Save a link" affordance linking to `/bookmark` (the capture page's empty state
    already carries the bookmarklet drag-link).
  - Renderer identical to Home's (passes `variant` through), so the user's layout mode —
    including Bento cover tiles — applies for free.

### Sidebar row (Phase 1)

- `items` entry in `GlobalNavigation`: `id: "bookmarks"`, `label: t("common.bookmarks")`,
  `path: ROUTES.BOOKMARKS`, `BookmarkIcon`, `active: routeKind === "bookmarks"`.
  Placement between `#unread` and Attachments (bookmarks trio groups naturally).
- `web/src/components/AppSidebar/routes.ts`:
  - `SidebarRouteKind` gains `"bookmarks"`; `getSidebarRouteKind` matches
    `ROUTES.BOOKMARKS` (before the `empty` fallback).
  - `routeSupportsCollectionScope`: include `"bookmarks"` — the feed is collection-scoped
    like home/attachments.
  - `getRouteActionPolicy`: `"bookmarks"` → same as attachments
    (`searchScope: "remembered-collection"`, `searchDestination: ROUTES.HOME`,
    `composePlacement: "remembered-space"`).
- Sidebar content: add `kind === "bookmarks"` to the `CollectionSidebarContent` condition
  (AppSidebar.tsx:285) and pass `context="home"` — `MemoStatsContext`
  (useFilteredMemoStats.ts:20) drives stats scoping, and `home` already means
  current-user + remembered collection, matching the creator-scoped bookmarks feed.
  // ponytail: dedicated has_link-scoped sidebar stats would widen MemoStatsContext and
  thread a filter through useFilteredMemoStats; add when bookmark-specific counts matter.

### i18n

- `en.json`: `common.bookmarks: "Bookmarks"` (+ reuse existing bookmark page strings
  where the empty state overlaps). Other locales fall back via the existing `fallbackLng`
  chain.

### Tests (Phase 1)

- `tests/app-sidebar-routes.test.ts`: extend the `it.each` table with
  `["/bookmarks", "bookmarks"]` (+ case-variant) and scope/policy assertions mirroring
  the attachments cases.
- `tests/router-config.test.tsx`: add `ROUTES.BOOKMARKS` to both guarded-route lists.- New `tests/bookmarks-page.test.tsx` (pattern: `tests/space-feed-pages.test.tsx`):
  asserts the page passes `has_link` in the combined filter and threads `variant`.

## Phase 2 — bookmark-manager polish (optional)

- Custom empty state when the feed is empty: bookmarklet drag-link (shared helper with
  the `/bookmark` page) + "Save your first link" CTA.
- Per-page layout default: force `layoutMode: "bento"` on this route (needs a small
  `ViewContext` override or prop — today the mode is global; noted ceiling, not MVP).
- Unread-first sort toggle (`tagSearch:unread` CEL combined in) — one button flipping an
  extra `tag in ["unread"]` condition.

## Non-goals / deferred

- Link-title search and title-sorted listing: `MemoPayload.links` lives in the protojson
  payload column; not CEL-indexable without schema + 3-driver migrations (bookmarks-plan
  Phase 4 territory).
- Collections/favorites (Raindrop-style): needs data model work.
- Any server change in MVP: none required.

## Verification gates

- `cd web && pnpm lint && pnpm test` (tests above).
- Manual: row visible+active, remembered Space filters the feed, bento mode shows cover
  tiles, `/bookmark` capture flow still lands on `/` (no collision with `/bookmarks`).
