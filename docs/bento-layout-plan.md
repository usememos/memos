# Bento Layout Plan

Status: Implemented (Phases 1–2; Phase 3 optional polish deferred)

> Implementation notes/deviations: `priorityKey` reorders the item to the first tile instead
> of pinning by coordinates (dense flow handles placement); `BentoGrid` is `Memo`-typed
> rather than generic since spans are estimator-driven; the variant threads through the
> `PagedMemoList` renderer options (`variant: "card" | "bento"`) into `MemoView`, so the
> four feed pages pass it along; Phase 2 cover tiles replace the header/body with a
> gradient overlay (title + creator + tap-through to detail) — the action menu and comment
> previews stay on the detail page for cover tiles, noted in code.

Goal: add a **bento-style layout** to the memo feed — a 2D grid where tiles vary in size
(featured memos and media-rich memos span multiple cells) instead of today's balanced
masonry columns. The explicit requirement: **check for reusable components before writing
anything from scratch.**

> Review note: tiles are NOT reliably bounded by compact mode — `CLAMP_PREVIEW_HEIGHT_PX`
> is 360 for the body alone (ClampedSection.tsx), plus header/reactions/comments. A fixed
> row unit with static spans would clip or overlap. Spans must be **derived from the
> existing height estimator** so tiles grow a row when content needs it.

## What exists today (verified)

| Piece | Where | Reusable for bento? |
| --- | --- | --- |
| Masonry engine | `web/src/components/ColumnGrid/ColumnGrid.tsx` — absolute positioning, per-column packing via shortest column, measured relayout, RTL-aware, leading tile, priority key | **Not directly.** Bento needs 2D row+column spans; ColumnGrid packs one tile into one column with translated offsets. Spans are impossible without rewriting its placement core. |
| Grid planning exports | `columnCountForWidth`, `GRID_GAP`, `assignColumnsByEstimatedHeight` from ColumnGrid | **Yes** — column-count policy, gap constant, and the "measure once, reflow once" relayout pattern. |
| Height estimator | `estimateMemoCardHeight` in `web/src/components/PagedMemoList/memoCardHeight.ts` | **Yes** — span decisions need a content-richness signal; this already encodes one. |
| Layout setting | `ViewContext.tsx`: `maxColumns: 1\|2\|3\|0` (auto), persisted to `localStorage["memos-view-setting"]`; UI radio in `MemoDisplaySettingMenu.tsx` (`LAYOUT_OPTIONS`, `grid-cols-4` radiogroup) | **Yes** — extend with a mode; column ceiling keeps meaning. |
| Feed orchestrator | `PagedMemoList.tsx` — picks flow vs `ColumnGrid`, owns `effectiveCompact`, `renderLeading({useGrid})`, priority hoist | **Yes** — add a third branch. |
| Card | `MemoView` (+ `compact` prop, `MEMO_CARD_BASE_CLASSES`) | **Yes** — unchanged tile contents in MVP. |
| Test patterns | `tests/column-grid.test.tsx`, `tests/column-grid-planner.test.ts`, `tests/column-count.test.ts`, `tests/paged-memo-list.test.tsx`, `tests/view-context-columns.test.tsx`, `tests/memo-display-setting-menu.test.tsx` | **Yes** — mirror them. |

## Component survey (the "don't build from scratch" check)

| Option | Verdict |
| --- | --- |
| `ColumnGrid` (in repo) | Wrong shape — masonry, no 2D spans. Reuse its exports/patterns, not its placement engine. |
| **Native CSS Grid** (`display: grid` + `grid-auto-flow: dense` + `col-span-*`/`row-span-*`) | **Choose this.** Bento is literally what CSS Grid is for. Tailwind v4 already in the repo (`col-span-2`, `row-span-2`, arbitrary `grid-auto-rows`). Zero dependencies, zero JS for placement, RTL-safe, virtualization-free pagination keeps working. |
| `react-grid-layout` (npm) | Drag-and-resize dashboard engine — solves a problem we don't have (read-only feed), adds ~30 KB and a second layout system. Reject. |
| `masonic` / `react-masonry-css` (npm) | Masonry again; duplicates `ColumnGrid`. Reject. |
| shadcn "bento block" snippets | Copy-paste marketing sections, not a layout component; repo has its own `ui/` kit on base-ui, no shadcn. Reject. |
| framer-motion `layout` | Animation polish only, new heavy dep; `tw-animate-css` already present for transitions. Reject (optional later). |

**Result: no new dependency. One small `BentoGrid` component (~100 LOC) beside `ColumnGrid`.**

## Chosen design

### `BentoGrid` component

`web/src/components/BentoGrid/BentoGrid.tsx` — mirrors the `ColumnGrid` props surface
(`items`, `getKey`, `renderItem`, `leading`, `priorityKey`, `maxColumns`, `maxColumnWidth`)
so `PagedMemoList` can swap it in with one branch. Placement is pure CSS:

- Container: `display: grid; grid-template-columns: repeat(count, minmax(0, 1fr)); gap: GRID_GAP; grid-auto-flow: dense`.
- Column count: existing `columnCountForWidth(width)` capped by `maxColumns` and `maxColumnWidth`, measured with the same ResizeObserver-once pattern as `columnCountForWidth` consumers.
- Row unit: **fixed `grid-auto-rows` (start: 260px; 220px small screens) — but `rowSpan` is computed, not hardcoded**: `rowSpan = clamp(ceil(estimateMemoCardHeight(memo, { columnWidth }) / rowUnit), 1, 3)`. Reuses `memoCardHeight.ts` so tiles never clip under normal estimation error; the wrapper gets `min-h-0 overflow-hidden` only as a guard against late-loading media overshooting the estimate.
- 1-column fallback: same rule as today — when only one column fits, render the flow list, not a degenerate grid.

### Span policy

`web/src/components/BentoGrid/bentoSpan.ts` — pure function `bentoSpan(memo, { columnCount, columnWidth })` returning `{ colSpan, rowSpan }`:

- `columnCount < 2` → always `1×1` (degenerate).
- `rowSpan = clamp(ceil(estimateMemoCardHeight(memo, { columnWidth }) / ROW_UNIT), 1, 3)` — content-driven, no measurement flicker.
- Pinned memo, or memo with link cover / ≥1 image-video attachment → `colSpan = 2` when `columnCount >= 2`; featured cap `2×2` minimum via `rowSpan = max(rowSpan, 2)` so a featured tile always reads as a hero.
- Everything else `1×rowSpan` (single column, height from the estimator).
- `grid-auto-flow: dense` backfills holes; span decisions are deterministic from memo data.

Exported pure → tested directly like `assignColumnsByEstimatedHeight` is today.

### Setting + UI

- `ViewContext`: add `layoutMode: "flow" | "masonry" | "bento"` to `ViewState` + `ViewContextValue`, persisted in the same `memos-view-setting` blob. Migration: absent key → `maxColumns === 1 ? "flow" : "masonry"` (existing users see zero change). `layoutMode` is authoritative; `maxColumns` only applies when the mode is not `flow`.
- `MemoDisplaySettingMenu.tsx` — the existing single radiogroup conflates mode with column count (`1`=List, `2/3`=Columns, `0`=Auto over `MAX_COLUMNS_VALUES`), so restructure the layout section into two rows:
  1. **Mode segmented control** (3 buttons): List (`Rows3Icon`), Columns (`Columns2Icon`), Bento (`LayoutGridIcon`) — new `LAYOUT_MODES` config, same button styling/roving-keydown as the current radiogroup.
  2. **Column-count radiogroup** — the existing `MAX_COLUMNS_VALUES` radiogroup and `LAYOUT_OPTIONS` Record stay byte-identical; shown only when mode is Columns or Bento. (List mode renders the flow list, so the control is meaningless there.)
- i18n: new keys in `src/locales/en.json` next to `memo.layout-*` (line ~365): `layout-bento`, `layout-bento-description`; other locales get English fallback per existing i18n convention.

### `PagedMemoList` wiring

- `const useBento = layoutMode === "bento"` branch replacing the `useGrid` ternary: bento renders `BentoGrid` with the same `renderItem`/`leading`/`priorityKey` props; `effectiveCompact` policy unchanged (bento is always multi-column → compact).
- `renderLeading` receives `useGrid: useBento || useGrid` so the Home composer (and Archived's leading content) takes the grid path unchanged.
- Composer (`renderLeading`) stays tile #1, full-row `grid-column: 1 / -1` — same intent as ColumnGrid's `leading` pinning.

## Phases

1. **MVP** — `BentoGrid` + `bentoSpan` (rowSpan from estimator) + `layoutMode` setting + two-row menu restructure + `PagedMemoList` branch. Tiles are existing compact `MemoView`s wrapped in `min-h-0 overflow-hidden` tile divs. Tests: `bento-span.test.ts` (span policy incl. rowSpan clamps), extend `view-context-columns.test.tsx` (migration), `memo-display-setting-menu.test.tsx` (mode control + hidden column row in List mode), `bento-grid.test.tsx` (dense placement class assertions, 1-col fallback, full-row leading).
2. **Visual tiles** — bento-only card variant: cover/background image tiles for link-covers and visual attachments (uses the Phase-1 bookmark cover attachments), title overlay style. Gated behind `layoutMode === "bento"` in `MemoView` props, no markup changes to list/masonry.
3. **Polish** — optional: enter/transition animation via `tw-animate-css`, span hints on hover, tune row unit + span tiers from real feeds.

## Non-goals

- Drag-and-drop reordering or user-resizable tiles (that is react-grid-layout territory; rejected above).
- Server-side layout persistence (localStorage matches today's `maxColumns` behavior).
- Changes to Explore/Archived/UserProfile pages beyond what they inherit through `PagedMemoList` automatically.

## Risks / notes

- `grid-auto-flow: dense` makes visual order ≠ DOM order; keyboard focus order follows DOM (feed order). Same tradeoff as masonry today — acceptable, note in the component doc comment.
- Estimator error ±1 row: tiles jitter a row between estimate and real content; dense packing absorbs it, the `overflow-hidden` guard masks overshoot, undershoot leaves harmless slack inside the tile.
- Appending a page reflows tile spans only for the dense-packed tail; infinite scroll already causes masonry relayout, so no regression.
- The absolute-positioning trap ColumnGrid documents (leading tile must not create a containing block for the composer's focus-mode overlay) does not apply — CSS grid items are static-positioned; no transforms.

## Verification gates

- `cd web && pnpm lint && pnpm test` (new tests above).
- Manual: toggle mode in display menu, check 1-col fallback at narrow width, RTL direction, composer leading tile, pinned memo featuring `2×2`.
