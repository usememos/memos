## References

Internal architecture audit (the source this plan reformats; line numbers verified against the working tree on the audit date 2026-05-17):

1. **`aurum-systems/01-system-overview.md`** — stack, directory map, central modules, the store/proto/codegen seams a new feature plugs into, build/test/lint workflow and conventions.
2. **`aurum-systems/02-memo-creation-flow.md`** — the memo-creation path traced end-to-end with `file:line` for every hop (editor → service → proto → handler → store → driver → SQL).
3. **`aurum-systems/03-draft-feature-proposal.md`** — design Options A/B/C, recommendation, phased plan, risk register. Superseded by 04 where they conflict.
4. **`aurum-systems/04-implementation-contract.md`** — **authoritative.** 4-way working-tree verification, C1–C4 corrections, endpoint/data contracts, the two frontend template functions, full touch-point inventory with DRY classification, 13 edge cases, the tests-first plan, the end-to-end measure, and design alternative D (payload-JSON) considered and rejected.

Key verified source anchors: `proto/api/v1/common.proto:7` (`enum State`), `proto/api/v1/memo_service.proto:201` (`Memo.state`), `server/router/api/v1/memo_service.go:73/181/452` (`CreateMemo`/`ListMemos`/`UpdateMemo`), `server/router/api/v1/common.go:20–38` (state converters), `store/common.go` (`RowStatus`), `store/memo.go:35–103` (`Memo`/`FindMemo`/`UpdateMemo`), `store/db/{sqlite,mysql,postgres}/memo.go:16` (driver `CreateMemo` INSERT), `store/migration/sqlite/LATEST.sql:39` (`row_status` CHECK), `web/src/components/MemoEditor/services/memoService.ts:77–123` (`save`), `web/src/hooks/useMemoQueries.ts:11–19/111–119` (`memoKeys`/`useMemos`).

## Industry Baseline

This is an internal feature; the baseline is the **existing in-repo lifecycle-state model**, not external systems. memos already expresses memo lifecycle as a `State` enum (`NORMAL`/`ARCHIVED`) projected onto the `memo.row_status` column, with `ARCHIVED` already given a creator-only read guard (`memo_service.go:48`) and an explicit creator-scoped list branch (`memo_service.go:191–202`). Every default reader already filters `row_status='NORMAL'`, so a new lifecycle value is excluded from public surfaces *for free* by the existing filters — provided the new value lives on the same axis.

The audit weighed four shapes against that baseline:

- **Option A — `State.DRAFT` enum value (chosen).** A draft is a `memo` row with `row_status='DRAFT'`. Reuses the existing column, the existing `FindMemo.RowStatus` predicate, the existing `ListMemos` state branch, and the existing archived creator-guard pattern. Work is mostly *exclusion discipline*, not new infrastructure.
- **Option B — separate `is_draft` boolean column.** Orthogonal to state, but adds a column across drivers **and** a proto field **and** `FindMemo`/`UpdateMemo` fields **and** an `is_draft=false` clause to every list query. Strictly more plumbing than A for the same outcome. Rejected.
- **Option C — frontend-only durable drafts (server-synced JSON blob).** No `memo` schema change, but drafts can't reuse memo rendering/attachments/relations; "publish" becomes a bespoke import path. Fights the grain of the codebase. Rejected.
- **Alternative D — `MemoPayload.draft` JSON flag.** No migration at all, and payload *is* filterable via the existing DSL. **Disqualified** because a payload-draft keeps `row_status='NORMAL'`, so it *passes* every currently-safe `NORMAL` filter — it inverts the leakage-safety property and grows the exclusion surface instead of shrinking it. Rejected.

## Research Summary

- **The data structure that is added is the absence of a new data structure.** A draft *is* a `Memo`. The frontend create payload (`memoService.ts:105–113`: `content`, `visibility`, `attachments`, `relations`, `location`, `createTime`, `updateTime`) is carried, persisted, and re-hydrated by the *existing* memo machinery. The only differentiator on the wire and in storage is `state = DRAFT`.
- **Three corrections materially change scope** (verified, supersede docs 02/03): **C1** state arrives via nested `request.Memo.State`, not a `CreateMemoRequest.state` field; **C2** `CreateMemo` does not read state today — new handler logic is required; **C3** the `row_status` CHECK exists in SQLite only — migration is SQLite-only, not 3-dialect.
- **C4 is the highest-risk finding** and was absent from docs 02/03: all three driver `CreateMemo` INSERTs omit `row_status` and rely on `DEFAULT 'NORMAL'`, so a draft create is silently published today. The first store test must encode this as a failing test that the C4 fix turns green.
- **The leakage surface is large but mostly already-safe.** ~9 reader surfaces (RSS, sitemap, MCP list/search/access, user stats, memo relations, payload runner, reaction SSE, read-access guard) must exclude `DRAFT`. Most are *already* explicit-NORMAL and only need a regression test pinning that they stay so; a minority (`checkMemoReadAccess`, MCP access, sitemap, relations, payload runner) need an added `Draft` guard.
- **Publish timestamp behavior is resolved** (Open Decision O4): `DRAFT → NORMAL` refreshes `created_ts`+`updated_ts`; a plain edit of a `NORMAL` memo must not. The guard is the *transition*, not "state in mask". Pinned by two opposing tests.
- **Test conventions confirmed** (subagent sweep): backend = stdlib `testing` + `testify/require`, `store/test/*_test.go` with `NewTestingStore(ctx,t)` + `createTestingHostUser`, multi-driver via TestContainers (`go test ./store/...`; default `DRIVER=sqlite`); API handler tests in `server/router/api/v1/*_test.go` style (`-race`, `DRIVER=sqlite`); frontend = Vitest + `@testing-library/react` in `web/tests/*.test.ts(x)` (`pnpm test`), extend `web/tests/memo-editor-cache.test.ts`. Gates: `go test ./...`, `golangci-lint run` (`errors.Wrap` not `fmt.Errorf`; gRPC `status.Errorf`), `go mod tidy -go=1.26.2`, `pnpm lint`, `pnpm test`, `buf lint` / `buf format -d`. The audit's §8 test plan already conforms — no new test infra.

## Design Goals

1. **G1 — Durable, cross-device, listable draft.** A saved draft survives `localStorage` clear and device switch and is retrievable via `ListMemos{state:DRAFT}`. Verifiable: create with `State.DRAFT`, read back from a fresh client → `state==DRAFT`.

2. **G2 — Inherit all memo functionality with zero new plumbing.** A draft carries content, visibility, attachments, relations, location, and custom timestamps through the *existing* `CreateMemo` blocks. Verifiable: the `saveDraft` payload is field-for-field the `save()` `MemoSchema` payload plus `state: DRAFT`; the attachment/relation/timestamp blocks run unchanged.

3. **G3 — Zero leakage.** A `DRAFT` memo is invisible to every non-creator surface — default `ListMemos`, RSS, sitemap, MCP list/search/resource, user stats, memo relations, payload runner, reaction SSE — and creator-only on direct `GetMemo` regardless of visibility. Verifiable: a seeded `DRAFT` is absent from each surface in a regression test; non-creator `GetMemo` on a `PUBLIC`-visibility draft → denied.

4. **G4 — Minimal blast radius / strict DRY.** No new table, struct, proto message, RPC, component, hook pattern, or test harness. One enum value + three mirrors; the migration copies the in-repo SQLite table-rebuild pattern verbatim; `saveDraft` reuses `save()`'s builder; `useDrafts` is a line-for-line analogue of `useMemos`. Verifiable: the touch-point inventory contains 0 ADD structs/RPCs/components.

5. **G5 — Side-effect correctness across the lifecycle.** Saving/editing a draft fires **no** webhook, SSE feed broadcast, or mention notification; publishing (`DRAFT → NORMAL`) fires the normal update side-effects exactly once and refreshes `created_ts`/`updated_ts`; an edit of a `NORMAL` memo never touches `created_ts`. Verifiable: assertion tests on the three suppressions at draft-save and on side-effect firing + timestamp refresh at publish, plus the opposing no-touch test.

6. **G6 — Tests precede implementation.** Every implementing phase (driver C4 fix, handler logic, frontend functions) is preceded by a task that authors failing tests against the existing harnesses; the C4 test must fail on today's tree and pass only after the fix. Verifiable: task ordering in `plan.md` places each test task before its implementing task with an explicit "expected: FAIL" validation.

## Non-Goals

All Non-Goals from `definition.md` apply. Additionally, design-specific:

- Implementing Option B (`is_draft` column), Option C (JSON-blob drafts), or alternative D (`MemoPayload.draft`) — all considered and rejected above.
- A foreign-key or new index for the draft state — `row_status` is already the indexed predicate via `FindMemo.RowStatus`.
- A new "Drafts" route/page beyond reusing `PagedMemoList` with `state=DRAFT` — the list rides the existing `memoKeys`/`PagedMemoList` machinery unchanged.
- Backfilling existing `localStorage` caches into server drafts — the two coexist (Open Decision O1); no migration of client cache state.

## Proposed Design

### 1. Data model — one enum value, three mirrors, nothing else

| Layer | File:line | Change |
|---|---|---|
| Proto enum | `proto/api/v1/common.proto:7–11` | add `DRAFT = 3;` to `enum State` |
| Go store enum | `store/common.go:12–20` | add `Draft RowStatus = "DRAFT"` beside `Normal`/`Archived` |
| Generated Go/TS | `proto/gen/**`, `web/src/types/proto/api/v1/common_pb.ts:42–56` | regenerated by `cd proto && buf generate` — never hand-edited |
| SQLite CHECK | `store/migration/sqlite/LATEST.sql:39` | add `'DRAFT'` to the `CHECK IN (...)` |

`store.Memo`/`FindMemo`/`UpdateMemo` already carry `RowStatus` (no struct change). MySQL/Postgres get **no migration** (C3 — no CHECK to relax). Optional frontend field `editingDraftName?: string` on `EditorState` only if resume is in v1 (Open Decision O3 — default: not added).

### 2. Schema migration (SQLite-only)

Add `store/migration/sqlite/0.29/00__memo_draft_state.sql` **copying the existing table-rebuild pattern verbatim** from `sqlite/0.3/00__memo_visibility_protected.sql` / `sqlite/0.26/03__alter_user_role.sql` (PRAGMA foreign_keys bracket → rename → rebuild with widened CHECK → re-INSERT → drop old). Update `sqlite/LATEST.sql:39`. Verify `store/migrator.go:299–319` tolerates a SQLite-only `0.29` with no parallel mysql/pg `0.29` (drivers already diverge: sqlite 0.2–0.28, mysql 0.17–0.28, pg 0.19–0.28) — edge E9, covered by a fresh-install + upgrade test.

### 3. Driver correctness fix (C4 — highest risk)

`store/db/{sqlite,mysql,postgres}/memo.go:16` `CreateMemo`: conditionally append `row_status` to the INSERT column list when `create.RowStatus != ""`. Without this, `CreateMemo` writes `NORMAL` and the draft is instantly public. UpdateMemo and list-filter paths already pass `*RowStatus` through unchanged — VERIFY only.

### 4. API handler contracts (no new RPCs)

- **`CreateMemo` (`memo_service.go:73`) — save a draft.** Map `request.Memo.State → create.RowStatus` via `convertStateToStore` (`common.go:31–38`, +`State_DRAFT → store.Draft`); `STATE_UNSPECIFIED` must still resolve to `NORMAL` (edge E1, C2 fix). Attachment/relation/timestamp blocks run unchanged (G2). **Suppress** the three side-effects at `memo_service.go:160/166/175` (`DispatchMemoCreatedWebhook`, `SSEHub.Broadcast`, `dispatchMemoMentionNotificationsBestEffort`) when `RowStatus==Draft` (G5).
- **`ListMemos` (`memo_service.go:191–202`) — query drafts.** Add a third branch mirroring the ARCHIVED creator-guard exactly: `else if request.State == STATE_DRAFT { memoFind.RowStatus=&Draft; if currentUser==nil → empty; memoFind.CreatorID=&currentUser.ID }`. Default stays explicit-NORMAL (drafts cannot leak into the default feed).
- **`UpdateMemo` (`memo_service.go:518–520`) — publish & edit-draft.** State flip works generically once `convertStateToStore` learns `DRAFT`. Detect the **transition** `prev==Draft && new==NORMAL` (state in `update_mask.paths`) → set `CreatedTs=now`, `UpdatedTs=now` (O4). A `NORMAL`→`NORMAL` edit must not touch `created_ts` (edge E5). Side-effects (`memo_update_helpers.go:65–78`): suppress while the memo stays `Draft`; fire normal `SSEEventMemoUpdated`+webhook on publish.

Converters also updated: `convertStateFromStore` (`common.go:20–29`, +`store.Draft → State_DRAFT`) and MCP `rowStatusToProto` (`mcp/api_helpers.go:24–29`, +`Draft`).

### 5. Leakage exclusion discipline (G3)

- **Add a `Draft` guard** (mirror the `Archived` guard): `checkMemoReadAccess` (`memo_service.go:42–71`, creator-only regardless of visibility — edges E2/E3, critical), MCP `checkMemoAccess` (`mcp/access.go:17–35`), MCP `applyVisibilityFilter` (`mcp/access.go:49–64`, constrain out `Draft` when `rowStatus` nil), sitemap (`frontend.go:150–152`, add `RowStatus:&Normal`), memo relations (`memo_relation_service.go:108–112`), payload runner (`memopayload/runner.go:35`), reaction SSE (`reaction_service.go`, suppress when parent is `Draft` & receiver≠creator).
- **VERIFY-only (already explicit-NORMAL — confirm with a test, change nothing):** `rss.go:89,140`; MCP `tools_memo.go` ListMemos `:274`/Search `:467`; `user_service_stats.go:208`; default `ListMemos`; frontend `PagedMemoList.tsx:92–100` (already `state: props.state || State.NORMAL`).

### 6. Frontend — two template functions, no new component

- **`memoService.saveDraft`** (`web/src/components/MemoEditor/services/memoService.ts`, near `:77`) — mirrors `save()`'s `create(MemoSchema, {...})` builder exactly, adding `state: State.DRAFT` as the only delta; `createMemo` for a new draft, `updateMemo` (mask incl. `state` held at `DRAFT`) when re-saving an existing draft. Must **bypass** `validationService.canSave` (`index.tsx:238`) — a draft may be incomplete (edge E4).
- **`useDrafts`** (`web/src/hooks/useMemoQueries.ts`, near `:111`) — line-for-line analogue of `useMemos`, `queryKey: memoKeys.list({...request, state: State.DRAFT})` so existing `memoKeys.lists()` invalidation in `handleSave` (`index.tsx:260–275`) covers drafts for free.
- **Wiring (split-button, not a second button):** in `src/components/MemoEditor/components/EditorToolbar.tsx` (component def `:10` `EditorToolbarProps`/`EditorToolbar`; primary `<Button onClick={onSave}>` at `:51`), keep the existing **Save** button as the primary action unchanged, and attach an adjacent caret (▾, `ChevronDownIcon` from `lucide-react`) that is a `DropdownMenuTrigger`. The dropdown contains a single `DropdownMenuItem` "Save as draft" wired to a new optional `onSaveDraft?` prop. **Reuse the shared Radix primitive** `@/components/ui/dropdown-menu` (`DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem`) — the same component `UserMenu`/`MemoActionMenu` already use, so this is still "no new component" (G4). `EditorToolbarProps` gains `onSaveDraft?: () => void`; the toolbar is rendered at `index.tsx:348` (`<EditorToolbar onSave={handleSave} … />`) where `onSaveDraft={handleSaveDraft}` is added. Add `handleSaveDraft` near `index.tsx:236` (sibling of `handleSave`) that calls `saveDraft`, then `discardDraft()` (`:257`, clears the matching `cacheService` key — edge E7) + the same `invalidateQueries` set as `handleSave` (`:260–275`). Resume = `getMemo(name)` → load into the editor reducer (no new function; creator-only via the §5 `checkMemoReadAccess` guard). *(Anchor correction: the audit's `EditorToolbar.tsx:~51` is path-drifted — the real path is `src/components/MemoEditor/components/EditorToolbar.tsx`, and `index.tsx:236` is `handleSave`, not the toolbar render site which is `:348`.)*

### 7. End-to-end measure

`Save split-button ▾ → "Save as draft" DropdownMenuItem → onSaveDraft → handleSaveDraft → memoService.saveDraft → memoServiceClient.createMemo(Memo.state=DRAFT) → APIV1Service.CreateMemo → convertStateToStore → Store.CreateMemo → driver CreateMemo (C4: emit row_status) → INSERT row_status=DRAFT; side-effects suppressed; discardDraft() clears localStorage; invalidateQueries covers useDrafts.` **List:** `useDrafts → ListMemos state=DRAFT → creator-only branch`. **Resume:** `getMemo → reducer (creator-only guard)`. **Publish:** `updateMemo mask=[state] state=NORMAL → transition detect → refresh created_ts/updated_ts → dispatchMemoUpdatedSideEffects fires once → memo now NORMAL, appears in default feed/RSS (already explicit-NORMAL, no change), disappears from Drafts.`
