# Create memo on selected calendar date — design

**Date:** 2026-05-02
**Scope:** Frontend-only.

## Problem

Clicking a date in the activity calendar filters the memo list to that date but does nothing for the inline editor. To create a memo dated for the selected day, the user must (1) create with today's timestamp, then (2) open the timestamp popover on the saved memo and edit `createTime`. This is a two-step retro-fill that defeats the calendar selection. Empty dates are also not clickable today, so the user cannot start the first memo for an empty day from the calendar at all.

## Goal

When a user picks a calendar date and immediately writes in the home editor, the resulting memo is created on that date — single-step.

## Non-goals

- Backend changes. The API already accepts custom `createTime` and `updateTime`.
- Changes to the comment/reply editor or the edit-mode editor.
- Changes outside the home page's editor render site (Explore/Archived/Profile pages have no editor).
- Reworking the timestamp popover UI itself.
- Empty-state copy changes on non-Home pages when an empty date is selected.

## User-visible behavior

1. **Empty calendar dates are clickable.** Clicking a date with zero memos sets the `displayTime` filter the same way a populated date does. Tooltip and selection ring still work.
2. **When the home editor renders with an active `displayTime` filter:**
   - The `TimestampPopover` (already used in edit mode) appears in create mode, pre-populated with the selected date.
   - The draft's `createTime` is set to **selected local date + current local hh:mm:ss** (e.g., picking May 1 at 14:32 → `2025-05-01 14:32`).
   - The draft's `updateTime` is set to the same value, to avoid the saved memo immediately reading "updated today" relative to a back-dated `createTime`.
   - The user can adjust either field via the popover before saving.
3. **When no `displayTime` filter is active**, the editor is identical to today: no popover in create mode, no override, server stamps with "now".
4. **Live derivation.** If the filter changes while a draft is in progress, the editor's prefilled timestamps re-sync to the new date. The popover stays visible so the change is observable. (Manual popover edits before the next filter change are overwritten — chosen tradeoff.)
5. **Future dates are allowed** (e.g., May 15 when today is May 2). Backend already accepts future timestamps.
6. **Other contexts** (Explore/Archived/Profile) gain empty-date clickability for navigation consistency, but have no editor and so no prefill behavior.

## Architecture

Four touch points, all in `web/src/`:

| File | Change |
|------|--------|
| `components/ActivityCalendar/CalendarCell.tsx` | Drop `day.count > 0` gate so empty in-month cells are clickable. |
| `components/MemoEditor/index.tsx` | Accept `defaultCreateTime?: Date` prop; render `TimestampPopover` in create mode when set; sync state on prop change. |
| `components/MemoEditor/utils/deriveDefaultCreateTime.ts` (new) | Pure helper: `(filters, now?) => Date \| undefined` derived from any `displayTime` filter. |
| `components/PagedMemoList/PagedMemoList.tsx` | At the home-editor render site (line 155), read `MemoFilterContext`, compute `defaultCreateTime`, pass as prop. |

### Data flow

```
CalendarCell click
  → useDateFilterNavigation
  → URL ?filter=displayTime:YYYY-MM-DD
  → MemoFilterContext re-renders
  → PagedMemoList recomputes defaultCreateTime via deriveDefaultCreateTimeFromFilters(filters)
  → <MemoEditor defaultCreateTime={...}> re-renders
  → editor reducer syncs state.timestamps (create + update) and renders TimestampPopover
  → save → memoService.ts:111 sends createTime/updateTime to API
```

## Component contracts

### `MemoEditor` — new prop

```ts
interface MemoEditorProps {
  // ...existing props
  /**
   * When set in create mode (no `memo` prop), seeds the draft's
   * createTime/updateTime and reveals the TimestampPopover so the
   * user can adjust. Tracked live: changes after mount re-sync state.
   * Ignored in edit mode (when `memo` is set).
   */
  defaultCreateTime?: Date;
}
```

Internal behavior:
- On `INIT_MEMO` for create mode, if `defaultCreateTime` is set, payload `timestamps` is `{ createTime: defaultCreateTime, updateTime: defaultCreateTime }`.
- A `useEffect` keyed on `[defaultCreateTime?.getTime(), memo]` dispatches `SET_TIMESTAMPS` whenever the prop changes in create mode.
- Popover render condition becomes `memoName || (!memo && state.timestamps.createTime)`.

### `deriveDefaultCreateTimeFromFilters` — pure helper

```ts
// web/src/components/MemoEditor/utils/deriveDefaultCreateTime.ts
export function deriveDefaultCreateTimeFromFilters(
  filters: MemoFilter[],
  now: Date = new Date(),
): Date | undefined {
  const dateFilter = filters.find((f) => f.factor === "displayTime");
  if (!dateFilter) return undefined;
  const [y, m, d] = dateFilter.value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
}
```

Notes:
- Defensive parse — returns `undefined` for malformed values rather than throwing.
- `now` is injectable for deterministic tests.
- Multiple `displayTime` filters are not produced by current UI; `find` ignores extras safely.

### `PagedMemoList.tsx` — call-site change

```tsx
const { filters } = useMemoFilterContext();
const defaultCreateTime = useMemo(
  () => deriveDefaultCreateTimeFromFilters(filters),
  [filters],
);
// ...
{showMemoEditor ? (
  <MemoEditor
    className="mb-2"
    cacheKey="home-memo-editor"
    placeholder={t("editor.any-thoughts")}
    defaultCreateTime={defaultCreateTime}
  />
) : null}
```

`useMemo` keyed on `filters` keeps the reference stable when the filter doesn't change, avoiding unnecessary editor re-syncs. `now` is captured once per filter change — matches "the local time when you picked the date".

### `CalendarCell.tsx` — empty-cell clickability

- `handleClick`: drop the `day.count > 0` check; just call `onClick(day.date)` if `onClick` is provided.
- `isInteractive`: `Boolean(onClick)`.
- `tabIndex` / `aria-disabled` / hover-cursor classes follow the new `isInteractive`.
- `shouldShowTooltip`: drop the `day.count > 0` gate; tooltip text already conveys the count.
- Out-of-month cells (existing early return) stay unclickable.
- The `selected` ring already works on count=0 cells. Visual contrast on the lowest-intensity background may need a small ring-weight bump in light theme; eyeball during implementation.

## Edge cases

- **No filter / filter cleared:** `defaultCreateTime` becomes `undefined`; editor falls back to current behavior.
- **User edits draft, then re-picks date:** live-derived; editor's `createTime` updates, popover reflects new value.
- **User manually edits via popover, then changes filter:** prop sync overwrites manual edit. Acceptable per design choice; popover keeps the change observable.
- **Draft cache (`cacheKey="home-memo-editor"`):** caches `content`, not `timestamps`. Reload restores text but `createTime` is freshly derived from current filter — consistent.
- **Future dates:** allowed. No clamp.
- **DST / timezone:** date arithmetic uses local time (`new Date(y, m-1, d, h, mi, s)`), matching `useDateFilterNavigation`'s local-date convention. Server receives an absolute `Timestamp`.
- **Comment editor (`MemoCommentSection`):** doesn't pass `defaultCreateTime` → no behavior change.
- **Edit mode (`memo` prop set):** prop is ignored; existing edit-mode popover is unchanged.
- **Empty-date click on Explore/Archived/Profile:** filters to empty date → "no memos" empty state. Acceptable.

## Testing

- **Unit (Vitest)** for `deriveDefaultCreateTimeFromFilters`:
  - no `displayTime` filter → `undefined`
  - valid `displayTime:2025-05-01` + injected `now=14:32:10` → `2025-05-01 14:32:10` local
  - malformed value (`"not-a-date"`, `"2025-13-40"`) → `undefined`
  - extra non-`displayTime` filters present → still works
- **Component (React Testing Library) for `CalendarCell`:** count=0 in-month cell is clickable, has correct `tabIndex`/`aria-disabled`, fires `onClick` with date.
- **Component for `MemoEditor`:** with `defaultCreateTime` prop, popover renders in create mode and `state.timestamps.createTime` matches; without prop, no popover; changing the prop re-syncs state.
- **Manual smoke (per CLAUDE.md UI-changes rule):** `pnpm dev`, click a non-today date (with and without existing memos), type a memo, save, confirm it appears under that date. Clear the filter chip; confirm a new memo posts to today.

## Risks

- The `useEffect` re-sync overwriting an in-progress popover edit is a *chosen* behavior. If users later complain, a "manual override sticky" flag is the natural follow-up. Not pre-built.
- Selection-ring contrast on the lowest-intensity background may need a small visual tweak; flagged for implementation.

## Out of scope (explicit)

- Sticky manual-override semantics for the popover.
- New empty-state copy on Explore/Archived/Profile when filtering to a date with zero memos.
- Any backend/API change.
- Any change to the comment editor, edit mode, or non-Home editor sites.
