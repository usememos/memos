# Calendar-Date Memo Prefill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user picks a date in the activity calendar, the home memo editor pre-fills its `createTime`/`updateTime` to that date and exposes the existing `TimestampPopover` so the user can adjust before saving. Empty calendar dates also become clickable.

**Architecture:** Frontend-only. A new pure helper derives a `Date` from the `displayTime` filter; `PagedMemoList` reads `MemoFilterContext` and passes the derived `Date` into `MemoEditor` via a new `defaultCreateTime` prop; `MemoEditor` seeds its reducer state from the prop, renders the popover when the prop is set in create mode, and re-syncs on prop change. `CalendarCell` drops the `count > 0` gate on click handling.

**Tech Stack:** React 18 + TypeScript, Vite 7, Vitest + jsdom + @testing-library/react, Tailwind v4, react-router. State via React Context + `useReducer`.

**Spec:** `docs/superpowers/specs/2026-05-02-calendar-date-prefill-design.md`

---

## File map

**Created**

- `web/src/components/MemoEditor/utils/deriveDefaultCreateTime.ts` — pure helper `(filters, now?) => Date | undefined`.
- `web/tests/derive-default-create-time.test.ts` — Vitest unit tests for the helper.
- `web/tests/calendar-cell-empty-clickable.test.tsx` — RTL test that count=0 in-month cells are clickable.

**Modified**

- `web/src/components/ActivityCalendar/CalendarCell.tsx` — drop `day.count > 0` gate from click/interactivity/tooltip.
- `web/src/components/MemoEditor/types/components.ts` — add `defaultCreateTime?: Date` to `MemoEditorProps`.
- `web/src/components/MemoEditor/hooks/useMemoInit.ts` — accept optional `defaultCreateTime`; in create mode, dispatch `SET_TIMESTAMPS` to seed `{ createTime, updateTime }`.
- `web/src/components/MemoEditor/index.tsx` — accept the new prop, pass it to `useMemoInit`, add a `useEffect` that re-syncs timestamps when the prop changes in create mode, render `TimestampPopover` when `(!memo && state.timestamps.createTime)`.
- `web/src/components/PagedMemoList/PagedMemoList.tsx` — read `useMemoFilterContext`, derive `defaultCreateTime`, pass to `<MemoEditor>` at line ~155.

---

## Task 1: Pure helper `deriveDefaultCreateTimeFromFilters`

**Files:**
- Create: `web/src/components/MemoEditor/utils/deriveDefaultCreateTime.ts`
- Test: `web/tests/derive-default-create-time.test.ts`

The helper takes the `filters` array from `MemoFilterContext` plus an injectable `now`, finds any `displayTime` filter (value format `YYYY-MM-DD`, local-date — produced by `useDateFilterNavigation` which forwards the `dayjs().format("YYYY-MM-DD")` string from `CalendarDayCell.date`), and returns a `Date` of `selected_date + now's hh:mm:ss`. Returns `undefined` if no `displayTime` filter or the value is malformed.

- [ ] **Step 1: Write the failing tests**

Create `web/tests/derive-default-create-time.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveDefaultCreateTimeFromFilters } from "@/components/MemoEditor/utils/deriveDefaultCreateTime";
import type { MemoFilter } from "@/contexts/MemoFilterContext";

describe("deriveDefaultCreateTimeFromFilters", () => {
  const now = new Date(2026, 4, 2, 14, 32, 10); // 2026-05-02 14:32:10 local

  it("returns undefined when no filters are set", () => {
    expect(deriveDefaultCreateTimeFromFilters([], now)).toBeUndefined();
  });

  it("returns undefined when no displayTime filter is present", () => {
    const filters: MemoFilter[] = [
      { factor: "tagSearch", value: "work" },
      { factor: "pinned", value: "true" },
    ];
    expect(deriveDefaultCreateTimeFromFilters(filters, now)).toBeUndefined();
  });

  it("merges the displayTime date with the current local hh:mm:ss", () => {
    const filters: MemoFilter[] = [{ factor: "displayTime", value: "2025-05-01" }];
    const result = deriveDefaultCreateTimeFromFilters(filters, now);
    expect(result).toBeDefined();
    expect(result!.getFullYear()).toBe(2025);
    expect(result!.getMonth()).toBe(4); // May (0-indexed)
    expect(result!.getDate()).toBe(1);
    expect(result!.getHours()).toBe(14);
    expect(result!.getMinutes()).toBe(32);
    expect(result!.getSeconds()).toBe(10);
  });

  it("ignores extra non-displayTime filters", () => {
    const filters: MemoFilter[] = [
      { factor: "tagSearch", value: "work" },
      { factor: "displayTime", value: "2025-05-01" },
      { factor: "pinned", value: "true" },
    ];
    const result = deriveDefaultCreateTimeFromFilters(filters, now);
    expect(result?.getDate()).toBe(1);
  });

  it("returns undefined for a malformed YYYY-MM-DD value", () => {
    const cases: MemoFilter[][] = [
      [{ factor: "displayTime", value: "not-a-date" }],
      [{ factor: "displayTime", value: "2025-13-40" }],
      [{ factor: "displayTime", value: "" }],
      [{ factor: "displayTime", value: "2025-5-1" }], // single-digit month/day
    ];
    for (const filters of cases) {
      expect(deriveDefaultCreateTimeFromFilters(filters, now)).toBeUndefined();
    }
  });

  it("uses real `new Date()` when `now` is omitted", () => {
    const filters: MemoFilter[] = [{ factor: "displayTime", value: "2025-05-01" }];
    const before = new Date();
    const result = deriveDefaultCreateTimeFromFilters(filters);
    const after = new Date();
    expect(result).toBeDefined();
    // Time-of-day should fall between before and after (within 1s tolerance).
    const resultTimeOnly = result!.getHours() * 3600 + result!.getMinutes() * 60 + result!.getSeconds();
    const beforeTimeOnly = before.getHours() * 3600 + before.getMinutes() * 60 + before.getSeconds();
    const afterTimeOnly = after.getHours() * 3600 + after.getMinutes() * 60 + after.getSeconds();
    // Handle midnight rollover by allowing any value if before > after.
    if (beforeTimeOnly <= afterTimeOnly) {
      expect(resultTimeOnly).toBeGreaterThanOrEqual(beforeTimeOnly);
      expect(resultTimeOnly).toBeLessThanOrEqual(afterTimeOnly);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && pnpm test derive-default-create-time`
Expected: FAIL — module `@/components/MemoEditor/utils/deriveDefaultCreateTime` does not exist.

- [ ] **Step 3: Implement the helper**

Create `web/src/components/MemoEditor/utils/deriveDefaultCreateTime.ts`:

```ts
import type { MemoFilter } from "@/contexts/MemoFilterContext";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Derive a default `createTime` for a new memo from the active memo filters.
 * If a `displayTime:YYYY-MM-DD` filter is present, returns that local date
 * combined with `now`'s wall-clock hh:mm:ss. Returns undefined otherwise or
 * when the filter value is malformed.
 */
export function deriveDefaultCreateTimeFromFilters(
  filters: MemoFilter[],
  now: Date = new Date(),
): Date | undefined {
  const dateFilter = filters.find((f) => f.factor === "displayTime");
  if (!dateFilter) return undefined;
  const match = DATE_RE.exec(dateFilter.value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Construct a local-time Date and verify the components round-trip
  // (catches things like 2025-13-40 that JS would silently roll forward).
  const candidate = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return undefined;
  }
  return candidate;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && pnpm test derive-default-create-time`
Expected: PASS — all 6 cases.

- [ ] **Step 5: Run lint**

Run: `cd web && pnpm lint`
Expected: PASS (TypeScript + Biome happy).

- [ ] **Step 6: Commit**

```bash
git add web/src/components/MemoEditor/utils/deriveDefaultCreateTime.ts web/tests/derive-default-create-time.test.ts
git commit -m "feat(memo-editor): add deriveDefaultCreateTimeFromFilters helper"
```

---

## Task 2: Make empty calendar cells clickable

**Files:**
- Modify: `web/src/components/ActivityCalendar/CalendarCell.tsx`
- Test: `web/tests/calendar-cell-empty-clickable.test.tsx`

`CalendarCell` currently gates `handleClick`, `isInteractive`, and `shouldShowTooltip` on `day.count > 0`. Drop those gates so any in-month cell is clickable when `onClick` is provided. Out-of-month cells (early-returned at line ~38) stay unclickable.

- [ ] **Step 1: Write the failing test**

Create `web/tests/calendar-cell-empty-clickable.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarCell } from "@/components/ActivityCalendar/CalendarCell";
import type { CalendarDayCell } from "@/components/ActivityCalendar/types";

const makeDay = (overrides: Partial<CalendarDayCell> = {}): CalendarDayCell => ({
  date: "2025-05-01",
  label: "1",
  count: 0,
  isCurrentMonth: true,
  isToday: false,
  isSelected: false,
  ...overrides,
});

describe("CalendarCell empty-day clickability", () => {
  it("fires onClick for an in-month day with count=0", () => {
    const onClick = vi.fn();
    render(<CalendarCell day={makeDay()} maxCount={5} tooltipText="May 1, 2025" onClick={onClick} />);

    const button = screen.getByRole("button", { name: /May 1, 2025/ });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledWith("2025-05-01");
  });

  it("renders an empty in-month day as interactive (tabIndex 0, not aria-disabled)", () => {
    render(<CalendarCell day={makeDay()} maxCount={5} tooltipText="May 1, 2025" onClick={() => {}} />);

    const button = screen.getByRole("button", { name: /May 1, 2025/ });
    expect(button).toHaveAttribute("tabindex", "0");
    expect(button).toHaveAttribute("aria-disabled", "false");
  });

  it("still renders a populated in-month day as interactive", () => {
    const onClick = vi.fn();
    render(<CalendarCell day={makeDay({ count: 3 })} maxCount={5} tooltipText="May 1, 2025" onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: /May 1, 2025/ }));
    expect(onClick).toHaveBeenCalledWith("2025-05-01");
  });

  it("does not render out-of-month days as interactive (no role=button)", () => {
    render(
      <CalendarCell
        day={makeDay({ isCurrentMonth: false })}
        maxCount={5}
        tooltipText="May 1, 2025"
        onClick={() => {}}
      />,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test calendar-cell-empty-clickable`
Expected: FAIL — first two tests fail because the empty cell currently has `tabindex="-1"`, `aria-disabled="true"`, and `onClick` is not invoked.

- [ ] **Step 3: Edit `CalendarCell.tsx` to drop the count gate**

Modify `web/src/components/ActivityCalendar/CalendarCell.tsx`. Three edits:

(a) Replace `handleClick`:

```tsx
  const handleClick = () => {
    if (onClick) {
      onClick(day.date);
    }
  };
```

(b) Replace `isInteractive`:

```tsx
  const isInteractive = Boolean(onClick);
```

(c) Replace `shouldShowTooltip`:

```tsx
  const shouldShowTooltip = tooltipText && !disableTooltip;
```

Leave the out-of-month early return (`if (!day.isCurrentMonth) { ... }`) untouched — out-of-month cells remain non-buttons.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test calendar-cell-empty-clickable`
Expected: PASS — all 4 cases.

- [ ] **Step 5: Run the full test suite to catch regressions**

Run: `cd web && pnpm test`
Expected: PASS. The existing `activity-calendar-tooltip.test.ts` covers `getTooltipText` (a separate utility) and shouldn't be affected.

- [ ] **Step 6: Run lint**

Run: `cd web && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/ActivityCalendar/CalendarCell.tsx web/tests/calendar-cell-empty-clickable.test.tsx
git commit -m "feat(activity-calendar): allow clicking empty in-month dates"
```

---

## Task 3: Add `defaultCreateTime` prop to `MemoEditorProps`

**Files:**
- Modify: `web/src/components/MemoEditor/types/components.ts`

Type-only change. No tests at this step — TypeScript compiler is the gate. Subsequent tasks consume the prop.

- [ ] **Step 1: Add the prop**

Modify `web/src/components/MemoEditor/types/components.ts`. Replace the `MemoEditorProps` interface (lines 6–16) with:

```ts
export interface MemoEditorProps {
  className?: string;
  cacheKey?: string;
  placeholder?: string;
  /** Existing memo to edit. When provided, the editor initializes from it without fetching. */
  memo?: Memo;
  parentMemoName?: string;
  autoFocus?: boolean;
  /**
   * Default `createTime` for a *new* memo (create mode only). When set, the
   * editor seeds both `createTime` and `updateTime` to this value and renders
   * the timestamp popover so the user can adjust before saving. Tracked live:
   * if the prop changes after mount, the editor's timestamps re-sync. Ignored
   * in edit mode (when `memo` is set).
   */
  defaultCreateTime?: Date;
  onConfirm?: (memoName: string) => void;
  onCancel?: () => void;
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd web && pnpm lint`
Expected: PASS (no consumer changes yet, prop is optional).

- [ ] **Step 3: Commit**

```bash
git add web/src/components/MemoEditor/types/components.ts
git commit -m "feat(memo-editor): add defaultCreateTime prop type"
```

---

## Task 4: Seed editor timestamps in `useMemoInit` (create mode)

**Files:**
- Modify: `web/src/components/MemoEditor/hooks/useMemoInit.ts`

`useMemoInit` currently handles edit mode (`if (memo)`) by calling `memoService.fromMemo(memo)` and `actions.initMemo(...)`. In create mode it only restores cached content and sets default visibility — it never touches timestamps. Extend the create branch so that when `defaultCreateTime` is set, it dispatches `SET_TIMESTAMPS` with `{ createTime: defaultCreateTime, updateTime: defaultCreateTime }`. This handles the *initial mount* case.

- [ ] **Step 1: Update `UseMemoInitOptions` and `useMemoInit`**

Modify `web/src/components/MemoEditor/hooks/useMemoInit.ts`. Replace the entire file with:

```ts
import { useEffect, useRef, useState } from "react";
import type { Memo, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import type { EditorRefActions } from "../Editor";
import { cacheService, memoService } from "../services";
import { useEditorContext } from "../state";

interface UseMemoInitOptions {
  editorRef: React.RefObject<EditorRefActions | null>;
  memo?: Memo;
  cacheKey?: string;
  username: string;
  autoFocus?: boolean;
  defaultVisibility?: Visibility;
  defaultCreateTime?: Date;
}

export const useMemoInit = ({
  editorRef,
  memo,
  cacheKey,
  username,
  autoFocus,
  defaultVisibility,
  defaultCreateTime,
}: UseMemoInitOptions) => {
  const { actions, dispatch } = useEditorContext();
  const initializedRef = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const key = cacheService.key(username, cacheKey);

    if (memo) {
      const initialState = memoService.fromMemo(memo);
      cacheService.clear(key);
      dispatch(actions.initMemo(initialState));
    } else {
      const cachedContent = cacheService.load(key);
      if (cachedContent) {
        dispatch(actions.updateContent(cachedContent));
      }
      if (defaultVisibility !== undefined) {
        dispatch(actions.setMetadata({ visibility: defaultVisibility }));
      }
      if (defaultCreateTime) {
        dispatch(actions.setTimestamps({ createTime: defaultCreateTime, updateTime: defaultCreateTime }));
      }
    }

    if (autoFocus) {
      setTimeout(() => editorRef.current?.focus(), 100);
    }

    setIsInitialized(true);
  }, [memo, cacheKey, username, autoFocus, defaultVisibility, defaultCreateTime, actions, dispatch, editorRef]);

  return { isInitialized };
};
```

Notes:
- The `defaultCreateTime` dependency is added to the effect's deps to satisfy the linter, but `initializedRef` ensures the body runs only once. Live re-sync after mount is handled by a separate effect in Task 5.
- Edit mode is unchanged — `defaultCreateTime` is intentionally ignored when `memo` is set.

- [ ] **Step 2: Verify compilation**

Run: `cd web && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/MemoEditor/hooks/useMemoInit.ts
git commit -m "feat(memo-editor): seed timestamps from defaultCreateTime on init"
```

---

## Task 5: Wire `defaultCreateTime` through `MemoEditor` and render popover

**Files:**
- Modify: `web/src/components/MemoEditor/index.tsx`

Three changes:
1. Destructure `defaultCreateTime` from props.
2. Pass it into `useMemoInit`.
3. Add a `useEffect` that dispatches `setTimestamps` whenever `defaultCreateTime` changes after mount (live re-sync per design Q3-A). Skip when `memo` is set.
4. Update the popover render condition so it shows in create mode too when timestamps are seeded.

- [ ] **Step 1: Destructure the prop and pass it to `useMemoInit`**

In `web/src/components/MemoEditor/index.tsx`, update the `MemoEditorImpl` destructuring (around line 42):

```tsx
const MemoEditorImpl: React.FC<MemoEditorProps> = ({
  className,
  cacheKey,
  memo,
  parentMemoName,
  autoFocus,
  placeholder,
  defaultCreateTime,
  onConfirm,
  onCancel,
}) => {
```

And update the `useMemoInit` call (around line 71):

```tsx
const { isInitialized } = useMemoInit({
  editorRef,
  memo,
  cacheKey,
  username: currentUser?.name ?? "",
  autoFocus,
  defaultVisibility,
  defaultCreateTime,
});
```

- [ ] **Step 2: Add the live re-sync effect**

In the same file, add a new `useEffect` after `useMemoInit` (and after `useAutoSave`) that re-syncs timestamps when `defaultCreateTime` changes in create mode. Place it just before the existing `useEffect` that fetches AI settings (around line 80):

```tsx
// Live-sync the draft's createTime/updateTime to the calendar-derived prop.
// Only applies in create mode; edit mode owns its own timestamps. Runs after
// initial mount (the seed value is set in useMemoInit), and again whenever
// the prop changes — e.g., when the user picks a different calendar date
// while the editor is open.
useEffect(() => {
  if (memo) return;
  if (!isInitialized) return;
  dispatch(
    actions.setTimestamps({
      createTime: defaultCreateTime,
      updateTime: defaultCreateTime,
    }),
  );
}, [defaultCreateTime, memo, isInitialized, actions, dispatch]);
```

Notes:
- We pass `undefined` through when the prop becomes undefined (filter cleared) — this resets timestamps to undefined so the editor falls back to "server-stamped now" on save, exactly the pre-feature behavior.
- The `isInitialized` guard avoids racing with `useMemoInit`'s one-shot seed.

- [ ] **Step 3: Update the popover render condition**

In the same file, find the existing block (around line 294):

```tsx
{memoName && (
  <div className="w-full -mb-1">
    <TimestampPopover />
  </div>
)}
```

Replace with:

```tsx
{(memoName || (!memo && state.timestamps.createTime)) && (
  <div className="w-full -mb-1">
    <TimestampPopover />
  </div>
)}
```

Now the popover renders in edit mode (unchanged) AND in create mode whenever a default timestamp has been seeded.

- [ ] **Step 4: Verify compilation**

Run: `cd web && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Run all tests**

Run: `cd web && pnpm test`
Expected: PASS (no editor-specific tests added; existing tests continue to pass).

- [ ] **Step 6: Commit**

```bash
git add web/src/components/MemoEditor/index.tsx
git commit -m "feat(memo-editor): live-sync timestamps and reveal popover from defaultCreateTime"
```

---

## Task 6: Wire calendar selection through `PagedMemoList`

**Files:**
- Modify: `web/src/components/PagedMemoList/PagedMemoList.tsx`

The home memo editor is rendered at line ~155 of `PagedMemoList.tsx`. Read the current `MemoFilterContext` filters, derive the `defaultCreateTime`, and pass it to `<MemoEditor>`. Wrap in `useMemo` so the reference stays stable when filters don't change (avoids re-firing the live-sync effect).

- [ ] **Step 1: Add the imports and derivation**

Modify `web/src/components/PagedMemoList/PagedMemoList.tsx`. Add to the existing imports near the top:

```tsx
import { useMemo } from "react";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { deriveDefaultCreateTimeFromFilters } from "@/components/MemoEditor/utils/deriveDefaultCreateTime";
```

If `useMemo` is already imported from `react` in this file, merge into the existing import rather than duplicating.

Inside the component body (above the `children` JSX, near the top of the function), add:

```tsx
const { filters } = useMemoFilterContext();
const defaultCreateTime = useMemo(
  () => deriveDefaultCreateTimeFromFilters(filters),
  [filters],
);
```

- [ ] **Step 2: Pass the prop to `<MemoEditor>`**

Replace the existing line ~155:

```tsx
{showMemoEditor ? <MemoEditor className="mb-2" cacheKey="home-memo-editor" placeholder={t("editor.any-thoughts")} /> : null}
```

with:

```tsx
{showMemoEditor ? (
  <MemoEditor
    className="mb-2"
    cacheKey="home-memo-editor"
    placeholder={t("editor.any-thoughts")}
    defaultCreateTime={defaultCreateTime}
  />
) : null}
```

- [ ] **Step 3: Verify compilation**

Run: `cd web && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Run all tests**

Run: `cd web && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/PagedMemoList/PagedMemoList.tsx
git commit -m "feat(home): pass calendar-selected date as default createTime to memo editor"
```

---

## Task 7: Manual smoke test

No code changes. Per `CLAUDE.md`: "For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete." Walk through the user-visible flows.

- [ ] **Step 1: Start the backend and frontend**

In one terminal:
```bash
go run ./cmd/memos --port 8081
```

In another:
```bash
cd web && pnpm dev
```

Open `http://localhost:3001`.

- [ ] **Step 2: Smoke — populated past date**

1. Sign in. Confirm the activity calendar is visible (statistics view).
2. Click a *past* date that already has memos.
3. Confirm the URL gains `?filter=displayTime:YYYY-MM-DD`.
4. Confirm the home memo editor shows the timestamp popover above the textarea, populated with the selected date.
5. Type a memo and click Save.
6. Clear the date filter (chip X). Reapply by clicking the same date.
7. Confirm the new memo appears under that date.

- [ ] **Step 3: Smoke — empty past date**

1. Pick a past date with **zero memos** in the calendar (lightest cell).
2. Confirm it is now clickable, the URL filter applies, and the empty-state shows.
3. Type and save a memo.
4. Confirm the memo appears for that date and the calendar cell tints up.

- [ ] **Step 4: Smoke — future date**

1. Click a future date in the current month.
2. Confirm the popover shows that date.
3. Save a memo. Confirm it appears under that date.

- [ ] **Step 5: Smoke — clear filter mid-draft**

1. Pick May 1 (or any non-today date). Type some content, do **not** save.
2. Click the filter chip X to clear the date filter.
3. Confirm the popover disappears and the draft content is preserved (autoSave behavior).
4. Save and confirm the memo gets a server-stamped "now" timestamp (i.e., appears under today).

- [ ] **Step 6: Smoke — change filter mid-draft**

1. Pick May 1. Type content.
2. Without saving, click May 3.
3. Confirm the popover updates to May 3.
4. Save. Confirm the memo appears under May 3.

- [ ] **Step 7: Smoke — comment editor unaffected**

1. Open any memo's detail view (or open the comments thread).
2. Confirm the reply editor does **not** show a timestamp popover.
3. Confirm the date filter has no visible effect on the reply editor.

- [ ] **Step 8: Smoke — edit mode unaffected**

1. Edit an existing memo (pencil icon).
2. Confirm the existing timestamp popover still works exactly as before, regardless of any active calendar filter.

- [ ] **Step 9: Smoke — empty-date click on Explore page**

1. Navigate to the Explore page (which also renders the calendar).
2. Click an empty date.
3. Confirm the URL filter applies and the empty-state shows. (No editor on Explore — that's correct.)

- [ ] **Step 10: Record results**

Note any unexpected behavior (especially: selection-ring contrast on the lowest-intensity background, mentioned as a flag in the spec). If the ring is too subtle, file a follow-up — *not* part of this plan.

---

## Self-review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Empty calendar dates clickable | Task 2 |
| Editor shows TimestampPopover in create mode when filter active | Task 5 (popover condition) |
| `createTime` = selected date + current local hh:mm:ss | Task 1 (helper) + Task 4 (seed) |
| `updateTime` mirrored to same value | Task 4 (seed) + Task 5 (live sync) |
| Live-derived: filter change re-syncs timestamps | Task 5 (live-sync `useEffect`) |
| Filter cleared → undefined → server-stamped "now" | Task 5 (passes `undefined` through) + Task 6 (helper returns undefined) |
| Future dates allowed (no clamp) | Task 1 (no clamp in helper); confirmed in Task 7 step 4 |
| Comment editor unaffected | Task 6 wires only `PagedMemoList`; confirmed in Task 7 step 7 |
| Edit mode unaffected | Task 4 + 5 explicitly guard on `memo`; confirmed in Task 7 step 8 |
| Empty-date click on Explore/Archived/Profile | Task 2 (calendar-side change); confirmed in Task 7 step 9 |
| DST/timezone uses local time | Task 1 (`new Date(y, m-1, d, h, mi, s)`) |
| Helper unit tests | Task 1 |
| `CalendarCell` empty-cell test | Task 2 |
| Manual smoke | Task 7 |

All spec requirements have a task. No gaps.

**Placeholder scan:** No "TBD"/"TODO" steps. Every code step shows the actual code.

**Type/name consistency check:**
- `MemoFilter` and `useMemoFilterContext` exist at `@/contexts/MemoFilterContext` (verified during exploration).
- `editorActions.setTimestamps` exists in `state/actions.ts:75` and accepts `Partial<EditorState["timestamps"]>` (verified). Calls in Tasks 4 and 5 match.
- `state.timestamps.createTime` is `Date | undefined` (verified `state/types.ts:27-29`). The popover render condition uses it as a truthy guard — `Date` instances are truthy, `undefined` is falsy.
- `useMemoFilterContext` (alias used in PagedMemoList) is exported from `MemoFilterContext.tsx:151` (verified).
- `deriveDefaultCreateTimeFromFilters` signature is identical between Task 1 (definition) and Task 6 (consumer).
- `defaultCreateTime: Date | undefined` flows consistently through `MemoEditorProps` (Task 3) → `MemoEditorImpl` destructuring (Task 5) → `useMemoInit` options (Task 4) → reducer payloads.
