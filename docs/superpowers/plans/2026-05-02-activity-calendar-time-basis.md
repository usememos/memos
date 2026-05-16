# ActivityCalendar Time Basis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the heatmap aggregation follow `ViewContext.timeBasis` so the calendar and the memo list agree about "today" when sorting by `update_time`.

**Architecture:** Add a parallel `memo_updated_timestamps` field to `UserStats`, populate it in the backend stats path the same way `memo_created_timestamps` is populated. On the frontend, `useFilteredMemoStats` reads `timeBasis` from `ViewContext` and picks the matching array; the resulting `timeBasis` is propagated down through `StatisticsView` → `MonthCalendar`/`YearCalendar` so the tooltip text reflects the active basis. No DB migration; the only schema change is one additive proto field.

**Tech Stack:** Go 1.26 / Protobuf / Connect RPC (backend), React 18 + TypeScript 6 + React Query v5 + i18next (frontend), Vitest (frontend tests), Go testify with TestContainers (backend tests).

**Spec:** `docs/superpowers/specs/2026-05-02-activity-calendar-time-basis-design.md`

---

## File Map

**Backend**
- Modify: `proto/api/v1/user_service.proto` (add field)
- Generated: `proto/gen/api/v1/user_service.pb.go` (regenerated)
- Generated: `web/src/types/proto/api/v1/user_service_pb.ts` (regenerated)
- Modify: `server/router/api/v1/user_service_stats.go` (populate field in both functions)
- Modify: `server/router/api/v1/test/user_service_stats_test.go` (assert new field)

**Frontend types & util**
- Modify: `web/src/components/ActivityCalendar/types.ts` (add `MemoTimeBasis` import, prop)
- Modify: `web/src/components/ActivityCalendar/utils.ts` (basis-aware tooltip)
- Modify: `web/src/components/ActivityCalendar/MonthCalendar.tsx` (accept & forward `timeBasis`)
- Modify: `web/src/components/ActivityCalendar/YearCalendar.tsx` (accept & forward `timeBasis`)

**Frontend data**
- Modify: `web/src/hooks/useFilteredMemoStats.ts` (read `timeBasis`, switch source)
- Modify: `web/src/types/statistics.ts` (add `timeBasis` to `StatisticsData` and `MonthNavigatorProps`)
- Modify: `web/src/components/StatisticsView/StatisticsView.tsx` (forward `timeBasis`)
- Modify: `web/src/components/StatisticsView/MonthNavigator.tsx` (forward `timeBasis`)

**Frontend i18n**
- Modify: `web/src/locales/en.json` (add `count-memos-updated-in-date` key)

**Frontend tests**
- Create: `web/tests/activity-calendar-tooltip.test.ts`
- Create: `web/tests/filtered-memo-stats.test.ts`

---

## Task 1: Add `memo_updated_timestamps` field to `UserStats` proto

**Files:**
- Modify: `proto/api/v1/user_service.proto`
- Generated (do not hand-edit): `proto/gen/api/v1/user_service.pb.go`, `web/src/types/proto/api/v1/user_service_pb.ts`

- [ ] **Step 1: Add the field**

Open `proto/api/v1/user_service.proto`. Find the `UserStats` message (around line 345). After the existing `memo_created_timestamps` line (currently `repeated google.protobuf.Timestamp memo_created_timestamps = 7;`), add:

```proto
  // The latest update timestamps of the user's memos (one per memo,
  // mirrors memo_created_timestamps). Used by the activity heatmap when
  // the client's view is set to update_time basis.
  repeated google.protobuf.Timestamp memo_updated_timestamps = 8;
```

The `total_memo_count = 6` field stays at tag 6; this new field claims tag 8 (tag 2 is reserved per the existing `reserved 2;` line).

- [ ] **Step 2: Regenerate proto code**

Run from the repo root:

```bash
(cd proto && buf generate)
```

Expected: regenerates `proto/gen/api/v1/user_service.pb.go` and `web/src/types/proto/api/v1/user_service_pb.ts` (plus OpenAPI). Verify `memoUpdatedTimestamps` appears in the TS file:

```bash
grep -n "memoUpdatedTimestamps\|memo_updated_timestamps" web/src/types/proto/api/v1/user_service_pb.ts
```

Expected output: matches in both the doc comment and the field declaration around the existing `memoCreatedTimestamps` block.

- [ ] **Step 3: Verify Go compiles**

```bash
go build ./...
```

Expected: success with no errors.

- [ ] **Step 4: Commit**

```bash
git add proto/api/v1/user_service.proto proto/gen/api/v1/user_service.pb.go web/src/types/proto/api/v1/user_service_pb.ts proto/gen/apidocs.swagger.yaml
git commit -m "proto(user_service): add memo_updated_timestamps to UserStats"
```

(If `buf generate` touches additional files, include them in the same commit.)

---

## Task 2: Populate `MemoUpdatedTimestamps` in `GetUserStats` (backend)

**Files:**
- Modify: `server/router/api/v1/user_service_stats.go:177-277`

The existing `GetUserStats` function (line 177) collects `createdTimestamps` from each memo. We add a parallel `updatedTimestamps`.

- [ ] **Step 1: Add the parallel slice declaration**

In `server/router/api/v1/user_service_stats.go`, find line 207:

```go
	createdTimestamps := []*timestamppb.Timestamp{}
```

Replace with:

```go
	createdTimestamps := []*timestamppb.Timestamp{}
	updatedTimestamps := []*timestamppb.Timestamp{}
```

- [ ] **Step 2: Append `UpdatedTs` inside the memo loop**

Find line 233 (inside `for _, memo := range memos`):

```go
				createdTimestamps = append(createdTimestamps, timestamppb.New(time.Unix(memo.CreatedTs, 0)))
```

Replace with:

```go
				createdTimestamps = append(createdTimestamps, timestamppb.New(time.Unix(memo.CreatedTs, 0)))
				updatedTimestamps = append(updatedTimestamps, timestamppb.New(time.Unix(memo.UpdatedTs, 0)))
```

- [ ] **Step 3: Set the new field on the returned struct**

Find line 262-274 (the `userStats := &v1pb.UserStats{...}` literal). Add the new field next to `MemoCreatedTimestamps`:

Before:

```go
	userStats := &v1pb.UserStats{
		Name:                  fmt.Sprintf("%s/stats", BuildUserName(user.Username)),
		MemoCreatedTimestamps: createdTimestamps,
		TagCount:              tagCount,
		...
```

After:

```go
	userStats := &v1pb.UserStats{
		Name:                  fmt.Sprintf("%s/stats", BuildUserName(user.Username)),
		MemoCreatedTimestamps: createdTimestamps,
		MemoUpdatedTimestamps: updatedTimestamps,
		TagCount:              tagCount,
		...
```

- [ ] **Step 4: Build and verify**

```bash
go build ./server/router/api/v1/...
```

Expected: success.

---

## Task 3: Populate `MemoUpdatedTimestamps` in `ListAllUserStats` (backend)

**Files:**
- Modify: `server/router/api/v1/user_service_stats.go:56-175`

`ListAllUserStats` (line 56) builds a per-user stats map across all users. We mirror Task 2 inside this loop.

- [ ] **Step 1: Initialize the slice on first sight of a user**

Find lines 99-110 (the `userMemoStatMap[memo.CreatorID] = &v1pb.UserStats{...}` literal). Add `MemoUpdatedTimestamps: []*timestamppb.Timestamp{},` next to `MemoCreatedTimestamps`:

```go
				userMemoStatMap[memo.CreatorID] = &v1pb.UserStats{
					Name:                  "",
					TagCount:              make(map[string]int32),
					MemoCreatedTimestamps: []*timestamppb.Timestamp{},
					MemoUpdatedTimestamps: []*timestamppb.Timestamp{},
					PinnedMemos:           []string{},
					MemoTypeStats: &v1pb.UserStats_MemoTypeStats{
						LinkCount: 0,
						CodeCount: 0,
						TodoCount: 0,
						UndoCount: 0,
					},
				}
```

- [ ] **Step 2: Append in the per-memo loop**

Find line 115:

```go
			stats.MemoCreatedTimestamps = append(stats.MemoCreatedTimestamps, timestamppb.New(time.Unix(memo.CreatedTs, 0)))
```

Replace with:

```go
			stats.MemoCreatedTimestamps = append(stats.MemoCreatedTimestamps, timestamppb.New(time.Unix(memo.CreatedTs, 0)))
			stats.MemoUpdatedTimestamps = append(stats.MemoUpdatedTimestamps, timestamppb.New(time.Unix(memo.UpdatedTs, 0)))
```

- [ ] **Step 3: Build**

```bash
go build ./server/router/api/v1/...
```

Expected: success.

- [ ] **Step 4: Commit Tasks 2 + 3 together**

```bash
git add server/router/api/v1/user_service_stats.go
git commit -m "feat(user_service): populate memo_updated_timestamps in user stats"
```

---

## Task 4: Backend test — assert `MemoUpdatedTimestamps` is populated

**Files:**
- Modify: `server/router/api/v1/test/user_service_stats_test.go`

Add a TDD-style test that creates a memo, updates it, and verifies both timestamp arrays are populated correctly.

- [ ] **Step 1: Write the failing test**

Append this function to `server/router/api/v1/test/user_service_stats_test.go`:

```go
func TestGetUserStats_MemoUpdatedTimestamps(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateHostUser(ctx, "ts-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	// Create one memo. Its created_ts and updated_ts are equal at creation.
	memo, err := ts.Store.CreateMemo(ctx, &store.Memo{
		UID:        "ts-memo-1",
		CreatorID:  user.ID,
		Content:    "first content",
		Visibility: store.Public,
	})
	require.NoError(t, err)
	require.NotNil(t, memo)

	// Bump updated_ts by updating content.
	newContent := "second content"
	updatedMemo, err := ts.Store.UpdateMemo(ctx, &store.UpdateMemo{
		ID:      memo.ID,
		Content: &newContent,
	})
	require.NoError(t, err)
	require.NotNil(t, updatedMemo)

	userName := fmt.Sprintf("users/%s", user.Username)
	resp, err := ts.Service.GetUserStats(userCtx, &v1pb.GetUserStatsRequest{Name: userName})
	require.NoError(t, err)
	require.NotNil(t, resp)

	require.Len(t, resp.MemoCreatedTimestamps, 1, "should have one created timestamp")
	require.Len(t, resp.MemoUpdatedTimestamps, 1, "should have one updated timestamp")

	require.Equal(t, updatedMemo.CreatedTs, resp.MemoCreatedTimestamps[0].AsTime().Unix())
	require.Equal(t, updatedMemo.UpdatedTs, resp.MemoUpdatedTimestamps[0].AsTime().Unix())
	require.GreaterOrEqual(
		t,
		resp.MemoUpdatedTimestamps[0].AsTime().Unix(),
		resp.MemoCreatedTimestamps[0].AsTime().Unix(),
		"updated_ts should be at or after created_ts",
	)
}
```

- [ ] **Step 2: Verify it passes (Tasks 2/3 already implement the behavior)**

```bash
go test -v -race -run TestGetUserStats_MemoUpdatedTimestamps ./server/router/api/v1/test/...
```

Expected: PASS.

If it fails because `store.UpdateMemo` has a different signature, inspect the existing usage in this same test file or in `store/memo.go` and adjust. The intent is "create a memo, update it, then read stats."

- [ ] **Step 3: Commit**

```bash
git add server/router/api/v1/test/user_service_stats_test.go
git commit -m "test(user_service): cover memo_updated_timestamps in stats"
```

---

## Task 5: Add `MemoTimeBasis` to ActivityCalendar types

**Files:**
- Modify: `web/src/components/ActivityCalendar/types.ts`

The calendar components currently take `data: CalendarData`. We add an optional `timeBasis` prop so the tooltip can label correctly.

- [ ] **Step 1: Re-export the basis type and add to props**

Open `web/src/components/ActivityCalendar/types.ts`. At the top, add an import:

```ts
import type { MemoTimeBasis } from "@/contexts/ViewContext";
```

In `MonthCalendarProps` (around line 22), add an optional field:

```ts
export interface MonthCalendarProps {
  month: string;
  data: CalendarData;
  maxCount: number;
  size?: CalendarSize;
  onClick?: (date: string) => void;
  selectedDate?: string;
  className?: string;
  disableTooltips?: boolean;
  timeBasis?: MemoTimeBasis;
}
```

In `YearCalendarProps` (around line 33), add the same field:

```ts
export interface YearCalendarProps {
  selectedYear: number;
  data: CalendarData;
  onYearChange: (year: number) => void;
  onDateClick: (date: string) => void;
  className?: string;
  timeBasis?: MemoTimeBasis;
}
```

- [ ] **Step 2: Type-check**

```bash
cd web && pnpm lint
```

Expected: PASS (no implementations consume the new prop yet — that's fine, it's optional).

---

## Task 6: Add basis-aware tooltip text + i18n key

**Files:**
- Modify: `web/src/locales/en.json:233`
- Modify: `web/src/components/ActivityCalendar/utils.ts:63-73`

- [ ] **Step 1: Add the new English locale key**

Open `web/src/locales/en.json`. Find line 233:

```json
    "count-memos-in-date": "{{count}} {{memos}} in {{date}}",
```

Add a sibling key right after it:

```json
    "count-memos-in-date": "{{count}} {{memos}} in {{date}}",
    "count-memos-updated-in-date": "{{count}} {{memos}} updated on {{date}}",
```

(Other locale files keep using only `count-memos-in-date`; i18next will fall back to English for the new key, matching the project's existing fallback strategy.)

- [ ] **Step 2: Update `getTooltipText` to take a `timeBasis`**

In `web/src/components/ActivityCalendar/utils.ts`, replace lines 63-73:

```ts
export const getTooltipText = (count: number, date: string, t: TranslateFunction): string => {
  if (count === 0) {
    return date;
  }

  return t("memo.count-memos-in-date", {
    count,
    memos: count === 1 ? t("common.memo") : t("common.memos"),
    date,
  }).toLowerCase();
};
```

With:

```ts
import type { MemoTimeBasis } from "@/contexts/ViewContext";

export const getTooltipText = (count: number, date: string, t: TranslateFunction, timeBasis: MemoTimeBasis = "create_time"): string => {
  if (count === 0) {
    return date;
  }

  const key = timeBasis === "update_time" ? "memo.count-memos-updated-in-date" : "memo.count-memos-in-date";
  return t(key, {
    count,
    memos: count === 1 ? t("common.memo") : t("common.memos"),
    date,
  }).toLowerCase();
};
```

(Move the new `import` to the top of the file with the other imports — don't leave it mid-file.)

- [ ] **Step 3: Write the unit test**

Create `web/tests/activity-calendar-tooltip.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getTooltipText } from "@/components/ActivityCalendar/utils";

// Minimal stub for the i18n translate fn — returns a deterministic string we can assert on.
const t = ((key: string, vars?: Record<string, unknown>) => {
  if (!vars) return key;
  const parts = Object.entries(vars).map(([k, v]) => `${k}=${String(v)}`);
  return `${key}|${parts.join(",")}`;
}) as Parameters<typeof getTooltipText>[2];

describe("getTooltipText", () => {
  it("returns just the date when count is 0", () => {
    expect(getTooltipText(0, "2026-05-02", t)).toBe("2026-05-02");
  });

  it("uses the created-tooltip key for create_time basis (default)", () => {
    const out = getTooltipText(3, "2026-05-02", t);
    expect(out.toLowerCase()).toContain("memo.count-memos-in-date");
    expect(out.toLowerCase()).not.toContain("updated");
  });

  it("uses the updated-tooltip key for update_time basis", () => {
    const out = getTooltipText(3, "2026-05-02", t, "update_time");
    expect(out.toLowerCase()).toContain("memo.count-memos-updated-in-date");
  });
});
```

- [ ] **Step 4: Run the test**

```bash
cd web && pnpm test activity-calendar-tooltip
```

Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/locales/en.json web/src/components/ActivityCalendar/utils.ts web/src/components/ActivityCalendar/types.ts web/tests/activity-calendar-tooltip.test.ts
git commit -m "feat(activity-calendar): basis-aware tooltip text"
```

---

## Task 7: Forward `timeBasis` through `MonthCalendar` and `YearCalendar`

**Files:**
- Modify: `web/src/components/ActivityCalendar/MonthCalendar.tsx:37-77`
- Modify: `web/src/components/ActivityCalendar/YearCalendar.tsx:71-114`

- [ ] **Step 1: Pass `timeBasis` into `getTooltipText` from `MonthCalendar`**

In `web/src/components/ActivityCalendar/MonthCalendar.tsx`, the destructured props line (around 38) currently reads:

```tsx
const { month, data, maxCount, size = "default", onClick, selectedDate, className, disableTooltips = false } = props;
```

Replace with:

```tsx
const { month, data, maxCount, size = "default", onClick, selectedDate, className, disableTooltips = false, timeBasis = "create_time" } = props;
```

In the `flatDays.map` block (line 61-71), the `getTooltipText` call currently reads:

```tsx
tooltipText={getTooltipText(day.count, day.date, t)}
```

Replace with:

```tsx
tooltipText={getTooltipText(day.count, day.date, t, timeBasis)}
```

- [ ] **Step 2: Pass `timeBasis` from `YearCalendar` into the inner `MonthCalendar`**

In `web/src/components/ActivityCalendar/YearCalendar.tsx`, `YearCalendar` is currently:

```tsx
export const YearCalendar = memo(({ selectedYear, data, onYearChange, onDateClick, className }: YearCalendarProps) => {
```

Replace with:

```tsx
export const YearCalendar = memo(({ selectedYear, data, onYearChange, onDateClick, className, timeBasis }: YearCalendarProps) => {
```

`MonthCard` is the inner component that renders `MonthCalendar`. Update its props type (line 71-76) and component (line 78-83):

Before:

```tsx
interface MonthCardProps {
  month: string;
  data: CalendarData;
  maxCount: number;
  onDateClick: (date: string) => void;
}

const MonthCard = memo(({ month, data, maxCount, onDateClick }: MonthCardProps) => (
  <article className="flex flex-col gap-2 rounded-xl border border-border/20 bg-muted/5 p-3 transition-colors hover:bg-muted/10">
    <header className="text-[10px] font-medium text-muted-foreground/80 uppercase tracking-widest">{getMonthLabel(month)}</header>
    <MonthCalendar month={month} data={data} maxCount={maxCount} size="small" onClick={onDateClick} disableTooltips />
  </article>
));
```

After:

```tsx
interface MonthCardProps {
  month: string;
  data: CalendarData;
  maxCount: number;
  onDateClick: (date: string) => void;
  timeBasis?: import("@/contexts/ViewContext").MemoTimeBasis;
}

const MonthCard = memo(({ month, data, maxCount, onDateClick, timeBasis }: MonthCardProps) => (
  <article className="flex flex-col gap-2 rounded-xl border border-border/20 bg-muted/5 p-3 transition-colors hover:bg-muted/10">
    <header className="text-[10px] font-medium text-muted-foreground/80 uppercase tracking-widest">{getMonthLabel(month)}</header>
    <MonthCalendar month={month} data={data} maxCount={maxCount} size="small" onClick={onDateClick} disableTooltips timeBasis={timeBasis} />
  </article>
));
```

(Prefer importing `MemoTimeBasis` at the top of the file with other imports rather than the inline `import(...)` form. The inline form above is shown only to avoid forgetting it; relocate it.)

Then in the `months.map(...)` block (around line 108), pass `timeBasis` down:

Before:

```tsx
{months.map((month) => (
  <MonthCard key={month} month={month} data={yearData} maxCount={yearMaxCount} onDateClick={onDateClick} />
))}
```

After:

```tsx
{months.map((month) => (
  <MonthCard key={month} month={month} data={yearData} maxCount={yearMaxCount} onDateClick={onDateClick} timeBasis={timeBasis} />
))}
```

- [ ] **Step 3: Type-check**

```bash
cd web && pnpm lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/ActivityCalendar/MonthCalendar.tsx web/src/components/ActivityCalendar/YearCalendar.tsx
git commit -m "feat(activity-calendar): forward timeBasis to tooltip"
```

---

## Task 8: Switch `useFilteredMemoStats` source by `timeBasis`

**Files:**
- Modify: `web/src/hooks/useFilteredMemoStats.ts`

- [ ] **Step 1: Read `timeBasis` from ViewContext and switch sources**

Replace the entire body of `web/src/hooks/useFilteredMemoStats.ts` with:

```ts
import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import { countBy } from "lodash-es";
import { useMemo } from "react";
import type { MemoExplorerContext } from "@/components/MemoExplorer";
import { type MemoTimeBasis, useView } from "@/contexts/ViewContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemos } from "@/hooks/useMemoQueries";
import { useUserStats } from "@/hooks/useUserQueries";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import type { StatisticsData } from "@/types/statistics";

export interface FilteredMemoStats {
  statistics: StatisticsData;
  tags: Record<string, number>;
  loading: boolean;
}

export interface UseFilteredMemoStatsOptions {
  userName?: string;
  context?: MemoExplorerContext;
}

const toDateString = (date: Date) => dayjs(date).format("YYYY-MM-DD");

const memoTimestampForBasis = (memo: Memo, basis: MemoTimeBasis): Date | undefined => {
  const ts = basis === "update_time" ? memo.updateTime : memo.createTime;
  return ts ? timestampDate(ts) : undefined;
};

export const useFilteredMemoStats = (options: UseFilteredMemoStatsOptions = {}): FilteredMemoStats => {
  const { userName, context } = options;
  const currentUser = useCurrentUser();
  const { timeBasis } = useView();

  // home/profile: use backend per-user stats (full tag set, not page-limited)
  const { data: userStats, isLoading: isLoadingUserStats } = useUserStats(userName);

  // explore: fetch memos with visibility filter to exclude private content.
  // ListMemos AND's the request filter with the server's auth filter, so private
  // memos are always excluded regardless of backend version.
  // other contexts: fetch with default params for the fallback memo-based path.
  const exploreVisibilityFilter = currentUser != null ? 'visibility in ["PUBLIC", "PROTECTED"]' : 'visibility in ["PUBLIC"]';
  const memoQueryParams = context === "explore" ? { filter: exploreVisibilityFilter, pageSize: 1000 } : {};
  const { data: memosResponse, isLoading: isLoadingMemos } = useMemos(memoQueryParams);

  const data = useMemo(() => {
    const loading = isLoadingUserStats || isLoadingMemos;
    let activityStats: Record<string, number> = {};
    let tagCount: Record<string, number> = {};

    if (context === "explore") {
      // Tags and activity stats from visibility-filtered memos (no private content).
      for (const memo of memosResponse?.memos ?? []) {
        for (const tag of memo.tags ?? []) {
          tagCount[tag] = (tagCount[tag] ?? 0) + 1;
        }
      }
      const displayDates = (memosResponse?.memos ?? [])
        .map((memo) => memoTimestampForBasis(memo, timeBasis))
        .filter((date): date is Date => date !== undefined)
        .map(toDateString);
      activityStats = countBy(displayDates);
    } else if (userName && userStats) {
      // home/profile: use backend per-user stats.
      //
      // Generated protobuf-es types make repeated fields non-optional T[], so an
      // old server that doesn't know the new field will deserialize as []. Since
      // memo.updated_ts is set to created_ts at row creation, the two arrays are
      // expected to be the same length whenever there are memos. Length-based
      // detection is therefore reliable: created non-empty AND updated empty
      // means "old server".
      const createdArray = userStats.memoCreatedTimestamps ?? [];
      const updatedArray = userStats.memoUpdatedTimestamps ?? [];
      const wantUpdated = timeBasis === "update_time";
      const oldServerFallback = wantUpdated && updatedArray.length === 0 && createdArray.length > 0;
      if (oldServerFallback) {
        console.warn("UserStats.memo_updated_timestamps not present; falling back to memo_created_timestamps");
      }
      const sourceArray = wantUpdated && !oldServerFallback ? updatedArray : createdArray;
      if (sourceArray.length > 0) {
        activityStats = countBy(
          sourceArray
            .map((ts) => (ts ? timestampDate(ts) : undefined))
            .filter((date): date is Date => date !== undefined)
            .map(toDateString),
        );
      }
      if (userStats.tagCount) {
        tagCount = userStats.tagCount;
      }
    } else if (memosResponse?.memos) {
      // archived/fallback: compute from cached memos
      const displayDates = memosResponse.memos
        .map((memo) => memoTimestampForBasis(memo, timeBasis))
        .filter((date): date is Date => date !== undefined)
        .map(toDateString);
      activityStats = countBy(displayDates);
      for (const memo of memosResponse.memos) {
        for (const tag of memo.tags ?? []) {
          tagCount[tag] = (tagCount[tag] || 0) + 1;
        }
      }
    }

    return { statistics: { activityStats, timeBasis }, tags: tagCount, loading };
  }, [context, userName, userStats, memosResponse, isLoadingUserStats, isLoadingMemos, timeBasis]);

  return data;
};
```

- [ ] **Step 2: Type-check**

```bash
cd web && pnpm lint
```

Expected: ONE error pointing at `web/src/types/statistics.ts` because `StatisticsData` doesn't yet have `timeBasis`. That's the next task; do not fix it here, leave the failure visible to drive Task 9.

If you see other unrelated errors, stop and reconcile.

---

## Task 9: Add `timeBasis` to `StatisticsData` and forward through `StatisticsView`/`MonthNavigator`

**Files:**
- Modify: `web/src/types/statistics.ts`
- Modify: `web/src/components/StatisticsView/StatisticsView.tsx`
- Modify: `web/src/components/StatisticsView/MonthNavigator.tsx`

- [ ] **Step 1: Extend the data shape**

Replace the contents of `web/src/types/statistics.ts` with:

```ts
import type { MemoTimeBasis } from "@/contexts/ViewContext";

export interface StatisticsViewProps {
  className?: string;
}

export interface MonthNavigatorProps {
  visibleMonth: string;
  onMonthChange: (month: string) => void;
  activityStats: Record<string, number>;
  timeBasis: MemoTimeBasis;
}

export interface StatisticsData {
  activityStats: Record<string, number>;
  timeBasis: MemoTimeBasis;
}
```

- [ ] **Step 2: Forward `timeBasis` from `StatisticsView`**

Open `web/src/components/StatisticsView/StatisticsView.tsx`. The current body (line 12-32) destructures `activityStats` from `statisticsData`. Replace with:

```tsx
const StatisticsView = (props: Props) => {
  const { statisticsData } = props;
  const { activityStats, timeBasis } = statisticsData;
  const navigateToDateFilter = useDateFilterNavigation();
  const [visibleMonthString, setVisibleMonthString] = useState(dayjs().format("YYYY-MM"));

  return (
    <div className="group w-full mt-2 flex flex-col text-muted-foreground animate-fade-in">
      <MonthNavigator
        visibleMonth={visibleMonthString}
        onMonthChange={setVisibleMonthString}
        activityStats={activityStats}
        timeBasis={timeBasis}
      />

      <div className="w-full animate-scale-in">
        <MonthCalendar
          month={visibleMonthString}
          data={activityStats}
          maxCount={calculateMaxCount(activityStats)}
          onClick={navigateToDateFilter}
          timeBasis={timeBasis}
        />
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Forward `timeBasis` from `MonthNavigator` into `YearCalendar`**

Open `web/src/components/StatisticsView/MonthNavigator.tsx`.

Replace the destructured prop list (line 11):

```tsx
export const MonthNavigator = memo(({ visibleMonth, onMonthChange, activityStats }: MonthNavigatorProps) => {
```

With:

```tsx
export const MonthNavigator = memo(({ visibleMonth, onMonthChange, activityStats, timeBasis }: MonthNavigatorProps) => {
```

Then update the `<YearCalendar ... />` call (line 62). Before:

```tsx
<YearCalendar selectedYear={currentYear} data={activityStats} onYearChange={handleYearChange} onDateClick={handleDateClick} />
```

After:

```tsx
<YearCalendar
  selectedYear={currentYear}
  data={activityStats}
  onYearChange={handleYearChange}
  onDateClick={handleDateClick}
  timeBasis={timeBasis}
/>
```

- [ ] **Step 4: Type-check**

```bash
cd web && pnpm lint
```

Expected: PASS.

- [ ] **Step 5: Commit Tasks 8 + 9 together**

```bash
git add web/src/hooks/useFilteredMemoStats.ts web/src/types/statistics.ts web/src/components/StatisticsView/StatisticsView.tsx web/src/components/StatisticsView/MonthNavigator.tsx
git commit -m "feat(activity-calendar): aggregate by ViewContext.timeBasis"
```

---

## Task 10: Frontend test — hook switches source by `timeBasis`

**Files:**
- Create: `web/tests/filtered-memo-stats.test.ts`

We test the hook indirectly by exercising the data-selection logic on a hand-built `userStats` object. Mocking the React Query hooks and ViewContext keeps the test fast and unit-scoped.

- [ ] **Step 1: Write the test**

Create `web/tests/filtered-memo-stats.test.ts`:

```ts
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies BEFORE importing the hook under test.
vi.mock("@/hooks/useUserQueries", () => ({
  useUserStats: vi.fn(),
}));
vi.mock("@/hooks/useMemoQueries", () => ({
  useMemos: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => ({ name: "users/test", id: 1 }),
}));

const mockUseView = vi.fn();
vi.mock("@/contexts/ViewContext", async () => {
  const actual = await vi.importActual<typeof import("@/contexts/ViewContext")>("@/contexts/ViewContext");
  return {
    ...actual,
    useView: () => mockUseView(),
  };
});

import { useUserStats } from "@/hooks/useUserQueries";
import { useFilteredMemoStats } from "@/hooks/useFilteredMemoStats";

const wrapper = ({ children }: { children: ReactNode }) => children as JSX.Element;

const ts = (year: number, month: number, day: number) => ({
  seconds: BigInt(Math.floor(Date.UTC(year, month - 1, day) / 1000)),
  nanos: 0,
});

describe("useFilteredMemoStats", () => {
  beforeEach(() => {
    vi.mocked(useUserStats).mockReturnValue({
      data: {
        memoCreatedTimestamps: [ts(2026, 5, 1), ts(2026, 5, 1), ts(2026, 5, 2)],
        memoUpdatedTimestamps: [ts(2026, 5, 3), ts(2026, 5, 3), ts(2026, 5, 3)],
        tagCount: {},
      },
      isLoading: false,
    } as ReturnType<typeof useUserStats>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates by created timestamps when timeBasis is create_time", () => {
    mockUseView.mockReturnValue({ timeBasis: "create_time", orderByTimeAsc: false, toggleSortOrder: vi.fn(), setTimeBasis: vi.fn() });

    const { result } = renderHook(() => useFilteredMemoStats({ userName: "users/test" }), { wrapper });

    expect(result.current.statistics.activityStats).toEqual({ "2026-05-01": 2, "2026-05-02": 1 });
    expect(result.current.statistics.timeBasis).toBe("create_time");
  });

  it("aggregates by updated timestamps when timeBasis is update_time", () => {
    mockUseView.mockReturnValue({ timeBasis: "update_time", orderByTimeAsc: false, toggleSortOrder: vi.fn(), setTimeBasis: vi.fn() });

    const { result } = renderHook(() => useFilteredMemoStats({ userName: "users/test" }), { wrapper });

    expect(result.current.statistics.activityStats).toEqual({ "2026-05-03": 3 });
    expect(result.current.statistics.timeBasis).toBe("update_time");
  });

  it("falls back to created timestamps when updated array is empty (old server)", () => {
    // Old servers that don't know about the new field deserialize it as [].
    // Length-divergence between created and updated is the reliable signal.
    vi.mocked(useUserStats).mockReturnValue({
      data: {
        memoCreatedTimestamps: [ts(2026, 5, 1)],
        memoUpdatedTimestamps: [],
        tagCount: {},
      },
      isLoading: false,
    } as ReturnType<typeof useUserStats>);
    mockUseView.mockReturnValue({ timeBasis: "update_time", orderByTimeAsc: false, toggleSortOrder: vi.fn(), setTimeBasis: vi.fn() });

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useFilteredMemoStats({ userName: "users/test" }), { wrapper });

    expect(result.current.statistics.activityStats).toEqual({ "2026-05-01": 1 });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test**

```bash
cd web && pnpm test filtered-memo-stats
```

Expected: 3/3 PASS.

If `JSX.Element` is unavailable in the test env (depends on `@testing-library/react` version), change `wrapper`'s return type to `any` or wrap children in a `<>` fragment via `React.createElement`. The intent is "render-only wrapper, no provider needed because we mocked useView".

- [ ] **Step 3: Commit**

```bash
git add web/tests/filtered-memo-stats.test.ts
git commit -m "test(activity-calendar): cover timeBasis source switching"
```

---

## Task 11: Manual verification & final lint

- [ ] **Step 1: Run all frontend checks**

```bash
cd web && pnpm lint && pnpm test
```

Expected: lint clean, all tests PASS.

- [ ] **Step 2: Run all backend checks**

```bash
go test -v -race ./server/router/api/v1/test/... -run "UserStats"
golangci-lint run
```

Expected: tests PASS, lint clean.

- [ ] **Step 3: Manual smoke test in dev**

In two terminals:

```bash
# terminal 1
go run ./cmd/memos --port 8081

# terminal 2
cd web && pnpm dev
```

Open `http://localhost:3001`, sign in, then:

1. Create a memo (today). Verify the heatmap shows +1 today.
2. Edit yesterday's memo (or any past memo, then immediately edit it).
3. Find the time-basis toggle (in the existing view settings; persists in `localStorage` under `memos-view-setting`). Switch to `update_time`.
4. **Expected**: the heatmap recomputes; the edited memo now shows on its `updated_ts` day, not its `created_ts` day. Tooltip text says "X memos updated on YYYY-MM-DD" (lowercase per `getTooltipText`).
5. Switch back to `create_time`. Heatmap reverts; tooltip says "X memos in YYYY-MM-DD".

If no UI control exists for the toggle, set it manually:

```js
// In browser console:
localStorage.setItem("memos-view-setting", JSON.stringify({ orderByTimeAsc: false, timeBasis: "update_time" }));
location.reload();
```

- [ ] **Step 4: No-op commit if nothing changed**

If steps 1-3 surfaced fixes, commit each fix. Otherwise nothing more to commit.
