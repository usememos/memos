# ActivityCalendar: Honor `timeBasis` (Create vs Update)

## Problem

The ActivityCalendar in `web/src/components/ActivityCalendar/` always aggregates by memo creation time, regardless of how the surrounding memo list is sorted.

The application already supports a global "time basis" toggle (`web/src/contexts/ViewContext.tsx:3`):

```ts
export type MemoTimeBasis = "create_time" | "update_time";
```

The toggle is persisted in `localStorage` and drives memo list ordering across the app. When a user switches the list to `update_time`, the heatmap below it continues to show creation counts — the two views literally disagree about what "today" means.

This is the user-visible bug we are fixing.

## Non-goals

The following were considered and explicitly excluded:

- **Tracking every individual edit event.** This would require resurrecting the `activity` table that was deliberately dropped in migration `0.27/03__drop_activity.sql`. The cost (write-path instrumentation, storage growth, privacy review) is not justified by this UI bug.
- **Tracking archive / restore / delete events.** Housekeeping actions, not contributions; would also leak private behavior on public Profile/Explore pages.
- **Adding comments or reactions to the heatmap count.** A reasonable separate feature, but a different decision (event-type expansion). Out of scope for this spec — one ticket, one problem.
- **Renaming `ActivityCalendar` to `ContributionCalendar`.** Out of scope.

## Design

### Semantics

The heatmap aggregates one timestamp per memo:

- When `timeBasis === "create_time"`: use `memo.created_ts` (current behavior).
- When `timeBasis === "update_time"`: use `memo.updated_ts`.

Each memo contributes exactly one cell of color, on the day of its chosen timestamp. This matches the list view's semantics exactly: in `update_time` mode, a memo edited on 5/1 and again on 5/2 appears once at 5/2 in the list, and the heatmap will show +1 on 5/2 and nothing on 5/1. The "lossiness" is identical to the lossiness already accepted by the list view — so by definition, the two are consistent.

### Backend

`UserStats` (proto/api/v1/user_service.proto) gains one field:

```proto
// The latest update timestamps of the user's memos.
repeated google.protobuf.Timestamp memo_updated_timestamps = 8;
```

The implementation mirrors `memo_created_timestamps` in `server/router/api/v1/user_service_stats.go`: in the same loop that appends `memo.CreatedTs` (line 115), also append `memo.UpdatedTs` to a parallel slice. The same `FindMemo` filters apply automatically: `RowStatus: NORMAL` (archived excluded), `ExcludeComments: true`, and the viewer-based visibility filter. Both `GetUserStats` and `ListAllUserStats` paths must be updated symmetrically.

No DB migration. No new tables. No new write paths.

### Frontend

`web/src/hooks/useFilteredMemoStats.ts` reads `useView().timeBasis` and switches its data source:

- `create_time` → `userStats.memoCreatedTimestamps` (today's behavior, untouched)
- `update_time` → `userStats.memoUpdatedTimestamps`

The `explore` context branch (which derives stats from the in-memory memo list rather than `userStats`) applies the same switch using `memo.createTime` vs `memo.updateTime` from the cached memos.

The `MonthCalendar` / `YearCalendar` components themselves require no changes — they receive an opaque `Record<date, count>` and render it. The change is confined to the data-source layer.

### Tooltip / labeling

A small but necessary clarification for the user: the cell tooltip should reflect which basis is active, e.g.

- `create_time` mode: "3 memos on May 2"
- `update_time` mode: "3 memos updated on May 2"

This belongs in `ActivityCalendar/utils.ts:getTooltipText`, which already takes a `t` translator. Add a `timeBasis` argument and pick the right i18n key.

## Components

| Unit | Responsibility | Depends on |
|---|---|---|
| `UserStats` proto | Carry both timestamp arrays | — |
| `GetUserStats` server impl | Populate both arrays from `memo` table | store |
| `useFilteredMemoStats` | Pick the correct array based on `timeBasis`; aggregate by day | `useView`, `useUserStats`, `useMemos` |
| `getTooltipText` | Render basis-aware tooltip | i18n |
| `MonthCalendar` / `YearCalendar` | Unchanged — render `Record<date, count>` | — |

## Data flow

```
ViewContext.timeBasis ──┐
                        ▼
   useFilteredMemoStats ── pick array ── countBy(day) ── Record<date,count> ── MonthCalendar
                        ▲
   userStats ───────────┤  (memo_created_timestamps OR memo_updated_timestamps)
                        │
   memos cache ─────────┘  (createTime OR updateTime — explore context only)
```

## Error handling

No new failure modes.

`protobuf-es` generates `repeated` fields as non-optional `T[]`, so an older server that doesn't populate the new field deserializes it as `[]` (never `undefined`). Naïvely treating empty as "no data" would be wrong, because a user with zero memos also gets `[]`. Detection uses **length divergence**: since `memo.updated_ts` is initialized to `created_ts` at row creation, the two arrays are the same length whenever there are any memos. So:

- `created.length === 0 && updated.length === 0` — user has no memos, render empty.
- `created.length > 0 && updated.length === created.length` — new server, normal path.
- `created.length > 0 && updated.length === 0` — old server, fall back to `memoCreatedTimestamps` regardless of `timeBasis`, with a one-line `console.warn`.

## Testing

- Unit test `useFilteredMemoStats`: given a fixed `userStats`, switching `timeBasis` returns aggregations matching the expected source array.
- Unit test the new `getTooltipText` branch.
- Manual verification: in dev, toggle the global time basis and confirm:
  - Heatmap recomputes
  - A memo edited yesterday but created last week shows up "yesterday" in update mode and "last week" in create mode
  - Tooltip text reflects the basis

## Migration / compatibility

- Proto field is additive (tag 8 is unused; tag 2 is `reserved`).
- Old clients ignore the new field.
- New clients tolerate old servers via the fallback above.
- No DB migration.
- No data backfill — `updated_ts` already exists on every memo row.

## Out-of-scope follow-ups (not part of this work)

These came up during brainstorming and are tracked here only so they aren't lost:

1. Adding comment / reaction event types to the heatmap count.
2. A "Memo History / Versions" feature (per-edit snapshots, diffs, optional commit messages). If pursued, the heatmap would become a downstream consumer of that history, and the field added here may be revisited.
