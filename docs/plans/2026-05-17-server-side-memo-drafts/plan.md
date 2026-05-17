## Task List

Ordering is **tests-first** (Design Goal G6). T1 is foundation only (adds the enum/const/migration so test code can compile and the CHECK accepts `'DRAFT'`) — it changes no behavior and leaves the tree green. T2–T5 author tests that **fail on today's tree** (C4 silently drops `row_status`; the handler ignores state; the frontend functions do not exist). T6–T9 implement the behavior that turns each red suite green, in dependency order. T10 is the gate sweep. Re-`rg` every cited `file:line` before editing — anchors were verified on the audit date and may have drifted.

**Task Index**

> T1: Foundation — `State.DRAFT` enum + `store.Draft` const + `buf generate` + SQLite migration/LATEST [M] — T2: Store-layer failing tests (TestContainers) [M] — T3: Migration fresh-install + upgrade failing tests [S] — T4: API-handler + leakage failing tests [L] — T5: Frontend failing tests (Vitest) [M] — T6: Driver C4 fix across 3 drivers → greens T2 [M] — T7: API-handler logic (converters, CreateMemo, ListMemos, UpdateMemo publish) → greens T4 [L] — T8: Leakage exclusion discipline (≈9 surfaces) → greens T4 leakage [L] — T9: Frontend `saveDraft` + `useDrafts` + toolbar/index wiring → greens T5 [L] — T10: Gate sweep + manual end-to-end pass [S]

### T1: Foundation — enum, const, codegen, SQLite migration [M]

**Objective**: Add the `DRAFT` lifecycle value and the SQLite schema room for it, without changing any behavior, so the tests-first tasks can compile and a fixed driver INSERT will not violate the CHECK (design §1, §2; G4).

**Size**: M (1 proto line, 1 Go const, regen, 1 new migration, 3–4 LATEST/CHECK edits; mechanical).

**Files**:
- Modify: `proto/api/v1/common.proto:7–11` — add `DRAFT = 3;` to `enum State`.
- Modify: `store/common.go:12–20` — add `Draft RowStatus = "DRAFT"`.
- Create: `store/migration/sqlite/0.29/00__memo_draft_state.sql`.
- Modify: `store/migration/sqlite/LATEST.sql:39` — add `'DRAFT'` to the `row_status` `CHECK IN (...)`.
- Regenerate (never hand-edit): `proto/gen/**`, `web/src/types/proto/api/v1/common_pb.ts`.

**Implementation**:
1. Add `DRAFT = 3;` after `ARCHIVED = 2;` in `enum State` (`common.proto`).
2. Add `Draft RowStatus = "DRAFT"` next to `Normal`/`Archived` in `store/common.go`. (`RowStatus.String()` is `return string(r)` — no coercion to fix.)
3. `cd proto && buf generate` — regenerates Go into `proto/gen/` and TS into `web/src/types/proto/`. Do not hand-edit generated files.
4. `store/migration/sqlite/0.29/00__memo_draft_state.sql`: **copy the table-rebuild pattern verbatim** from `store/migration/sqlite/0.3/00__memo_visibility_protected.sql` (and cross-check `sqlite/0.26/03__alter_user_role.sql`): `PRAGMA foreign_keys=off;` → `ALTER TABLE memo RENAME TO memo_old;` → recreate `memo` with `row_status` `CHECK IN ('NORMAL','ARCHIVED','DRAFT')` (all other columns/constraints byte-identical to current `LATEST.sql`) → `INSERT INTO memo SELECT * FROM memo_old;` → `DROP TABLE memo_old;` → `PRAGMA foreign_keys=on;`. No novel migration style.
5. `sqlite/LATEST.sql:39`: widen the `CHECK IN (...)` to include `'DRAFT'`. Do **not** touch `mysql/LATEST.sql` or `postgres/LATEST.sql` (C3 — no CHECK there).

**Boundaries**: Must NOT add MySQL/Postgres migrations or LATEST edits (C3). Must NOT add struct fields to `store.Memo`/`FindMemo`/`UpdateMemo` (already carry `RowStatus`). Must NOT change handler/driver/frontend behavior. Must NOT hand-edit generated proto files.

**Dependencies**: None.

**Expected Outcome**: `DRAFT`/`Draft` exist at every layer; SQLite accepts a `'DRAFT'` `row_status`; tree still builds and all existing tests still pass (behavior unchanged — a draft create still silently becomes `NORMAL` until T6).

**Validation**:
- `rg -n "DRAFT" proto/api/v1/common.proto store/common.go web/src/types/proto/api/v1/common_pb.ts` — expects the enum value present in all three.
- `cd proto && buf lint && buf format -d` — expects clean.
- `go build ./...` — expects PASS. `go test ./store/test/ -run TestMemo -count=1` (existing memo tests) — expects PASS (no behavior change).
- `rg -n "CHECK.*DRAFT" store/migration/sqlite` — expects hits in `0.29/00__memo_draft_state.sql` and `LATEST.sql`; `rg -n "DRAFT" store/migration/{mysql,postgres}` — expects **no** hits.

---

### T2: Store-layer failing tests (TestContainers) [M]

**Objective**: Encode draft persistence semantics as tests that **fail on today's tree** — proving C4/E10 (driver silently drops `row_status`) — before any driver fix (G6; audit §8.1).

**Size**: M (one test file extension; mirrors `store/test/memo_test.go` patterns).

**Files**:
- Modify (or create alongside): `store/test/memo_test.go` (or `store/test/memo_draft_test.go` following the same package/harness).

**Implementation** — using `NewTestingStore(ctx,t)` + `createTestingHostUser`, `testify/require`:
1. `TestMemoDraftCreateAndReadBack` — `CreateMemo(&store.Memo{RowStatus: store.Draft, ...})`, re-`GetMemo`, `require.Equal(store.Draft, got.RowStatus)`. **Expected: FAIL today** (C4 — INSERT omits `row_status`, row is `Normal`).
2. `TestMemoDraftExcludedFromNormalList` — create 1 `Normal` + 1 `Draft`; `ListMemos(FindMemo{RowStatus:&Normal})` returns only the `Normal`.
3. `TestMemoDraftListedWhenRequested` — `ListMemos(FindMemo{RowStatus:&Draft, CreatorID:&u})` returns only the draft.
4. `TestMemoPublishRefreshesCreatedTs` — create `Draft` with an old `created_ts`; `UpdateMemo` `Draft→Normal`; assert both `created_ts` and `updated_ts` advanced (E5 forward, O4).
5. `TestMemoNormalEditDoesNotTouchCreatedTs` — edit a `Normal` memo's content; assert `created_ts` unchanged (E5 reverse).

**Boundaries**: Must NOT modify driver/handler code to make these pass (that is T6/T7). Must NOT add new test infra. Must NOT assert backend-specific error strings.

**Dependencies**: T1.

**Expected Outcome**: Tests compile and run; #1 (and likely #4) FAIL on the current tree, proving C4/E5 are real. Record the red as expected.

**Validation**:
- `DRIVER=sqlite go test ./store/test/ -run 'TestMemoDraft|TestMemoPublish|TestMemoNormalEdit' -count=1 -v` — expects `TestMemoDraftCreateAndReadBack` (and `TestMemoPublishRefreshesCreatedTs`) **FAIL**; others may pass. Document the failing set.

---

### T3: Migration fresh-install + upgrade failing tests [S]

**Objective**: Pin that a fresh SQLite `LATEST.sql` accepts a `DRAFT` insert and that an upgrade from 0.28 → 0.29 preserves rows and unlocks `DRAFT` — and that the SQLite-only `0.29` dir does not break the version scan (E9; audit §8.2).

**Size**: S (two focused tests; reuse the migrator test harness).

**Files**:
- Modify/create: a migrator-level test alongside the existing migration tests (match whatever harness `store/migrator.go` tests use; if none, drive via `NewTestingStore` which runs `LATEST.sql`).

**Implementation**:
1. Fresh-install: apply SQLite `LATEST.sql`, insert a memo with `row_status='DRAFT'`, assert success.
2. Upgrade: seed a store at 0.28, run the migrator to 0.29, assert pre-existing rows intact and a `DRAFT` insert now succeeds.
3. Version-scan tolerance: assert `store/migrator.go:299–319` `GetCurrentSchemaVersion` accepts a SQLite-only `0.29` with no parallel mysql/pg `0.29` (drivers already diverge today).

**Boundaries**: Must NOT add mysql/pg `0.29` dirs to "balance" versions (C3). Must NOT alter `migrator.go` in this task (if the scan rejects divergence, that is a finding for T6's scope, recorded here).

**Dependencies**: T1.

**Expected Outcome**: Fresh-install passes immediately (T1 relaxed the CHECK); upgrade test passes; version-scan assertion documents E9 behavior.

**Validation**:
- `DRIVER=sqlite go test ./store/... -run 'Migrat|Draft.*Migration' -count=1 -v` — expects fresh-install + upgrade PASS, version-scan assertion PASS (or a recorded E9 finding if it fails).

---

### T4: API-handler + leakage failing tests [L]

**Objective**: Encode the full handler contract and the zero-leakage guarantee as tests that **fail on today's tree** before any handler/leakage change (G3, G5, G6; audit §8.3).

**Size**: L (broad surface: create/list/update + converter unit tests + ≈9-surface leakage regression).

**Files**:
- Create/modify: `server/router/api/v1/memo_service_test.go` (and a converter unit test alongside `common.go`), following the existing `server/router/api/v1` test style (`-race`, `DRIVER=sqlite`).

**Implementation** — assert, expecting RED today:
1. `CreateMemo` with `Memo.State=DRAFT` → persisted as draft **and** no webhook, no SSE feed broadcast, no mention notification (assert the three suppressions at `memo_service.go:160/166/175`).
2. `CreateMemo` with `State=UNSPECIFIED` → still `NORMAL` (E1).
3. Default `ListMemos` (no state) → seeded draft absent.
4. `ListMemos{state:DRAFT}` as creator → only own drafts; unauthenticated → empty list, not error (mirror archived precedent).
5. Non-creator `GetMemo` on another user's draft incl. `PUBLIC` visibility → denied (E2/E3).
6. `UpdateMemo` publish `Draft→Normal` → fires webhook+SSE exactly once and `created_ts`/`updated_ts` refreshed (O4); `Normal`→`Normal` edit → no side-effect timestamp change (E5).
7. Converter round-trip unit test: `convertStateToStore` / `convertStateFromStore` / MCP `rowStatusToProto` incl. `DRAFT` both directions; default arm still maps unknown→`Normal` (E12).
8. Leakage regression: seed one `DRAFT`, assert it is absent from RSS (`rss.go`), sitemap (`frontend.go`), MCP list/search/resource (`mcp/tools_memo.go`, `mcp/access.go`), user stats (`user_service_stats.go`), memo relations (`memo_relation_service.go`), payload runner (`memopayload/runner.go`), and reaction SSE.

**Boundaries**: Must NOT implement handler/leakage fixes here. Must NOT weaken assertions to "pass today". Must NOT add new test harnesses — extend the existing `api/v1` test style.

**Dependencies**: T1. (Independent of T2/T3; can be authored in parallel.)

**Expected Outcome**: Suite compiles; the create-suppression, UNSPECIFIED, list-DRAFT, non-creator-GetMemo, publish, and converter tests FAIL on today's tree. Leakage tests for already-explicit-NORMAL surfaces (RSS, default list, user stats, MCP list/search) likely PASS now and must stay green (regression pins); the added-guard surfaces (read-access, MCP access, sitemap, relations, payload runner, reaction SSE) FAIL today. Document the red/green split.

**Validation**:
- `DRIVER=sqlite go test ./server/router/api/v1/... ./server/router/mcp/... -run 'Draft' -race -count=1 -v` — expects the documented RED set to FAIL, the explicit-NORMAL regression set to PASS.

---

### T5: Frontend failing tests (Vitest) [M]

**Objective**: Pin the two frontend template functions' contracts before they exist (G2, G4, G6; audit §8.4).

**Size**: M (extend `web/tests/memo-editor-cache.test.ts`; add a hook test).

**Files**:
- Modify: `web/tests/memo-editor-cache.test.ts` (existing `vi.stubGlobal("localStorage", …)` + in-memory Map pattern).
- Create: `web/tests/use-drafts.test.ts` (or colocate per the existing `web/tests/` convention).
- Create: `web/tests/editor-toolbar-save-draft.test.tsx` (split-button render + interaction, `@testing-library/react` like `web/tests/about-page.test.tsx`).

**Implementation** — Vitest + `@testing-library`, expecting RED:
1. `saveDraft` builds the **same** `MemoSchema` field set as `save` plus `state: State.DRAFT` (snapshot the field set — proves §2/G2 inheritance).
2. On successful `saveDraft`, the matching `cacheService` key is cleared (E7).
3. `useDrafts` issues `ListMemos` with `state=DRAFT` and its `queryKey` equals `memoKeys.list({state:DRAFT})` (cache-invalidation correctness).
4. `saveDraft` does **not** require `validationService.canSave` (a draft may be empty/partial — E4).
5. `EditorToolbar` renders the primary Save button **and** a ▾ caret; the caret is not present when `onSaveDraft` is undefined; opening it and clicking "Save as draft" calls `onSaveDraft` exactly once and does **not** call `onSave` (split-button interaction, `@testing-library` `userEvent`).

**Boundaries**: Must NOT implement `saveDraft`/`useDrafts` here. Must NOT mock away the `MemoSchema` builder (the snapshot must reflect the real shared builder).

**Dependencies**: T1 (needs regenerated TS `State.DRAFT`).

**Expected Outcome**: Tests compile and FAIL (functions absent).

**Validation**:
- `cd web && pnpm test --run -t "saveDraft|useDrafts"` — expects FAIL (unresolved imports / missing exports), recorded as expected.

---

### T6: Driver C4 fix across three drivers → greens T2 [M]

**Objective**: Make `CreateMemo` actually persist `row_status` so a draft is stored as `DRAFT` (C4/E10 fix; design §3).

**Size**: M (3 driver edits; same conditional in each).

**Files**:
- Modify: `store/db/sqlite/memo.go:16`, `store/db/mysql/memo.go:16`, `store/db/postgres/memo.go:16` (`CreateMemo` INSERT).

**Implementation**: In each driver's `CreateMemo`, conditionally append `row_status` to the INSERT column list and the corresponding value/placeholder **when `create.RowStatus != ""`** (preserve the `DEFAULT 'NORMAL'` path when empty, so existing callers are byte-for-byte unchanged). Match each driver's existing placeholder idiom (`?` sqlite/mysql, `$N` postgres). UpdateMemo and list-filter paths already pass `*RowStatus` — VERIFY unchanged, do not edit.

**Boundaries**: Must NOT unconditionally add `row_status` (would change behavior for all existing creates). Must NOT add upsert/transaction helpers. Must NOT touch UpdateMemo/list SQL.

**Dependencies**: T1, T2 (T2 defines the red this greens).

**Expected Outcome**: T2 store tests pass on SQLite (and on MySQL/Postgres in CI's container matrix).

**Validation**:
- `DRIVER=sqlite go test ./store/test/ -run 'TestMemoDraft|TestMemoPublish|TestMemoNormalEdit' -count=1 -v` — expects all PASS (T2 now green; #4 still depends on T7's publish logic — if so, note #4 stays red until T7 and re-verify there).
- `go build ./...` — expects PASS.

---

### T7: API-handler logic → greens T4 (non-leakage) [L]

**Objective**: Implement the create/list/update draft semantics and side-effect rules (design §4; C2 fix; O4; G5).

**Size**: L (branching across three handlers + two converters + side-effect helper).

**Files**:
- Modify: `server/router/api/v1/common.go:20–38` (`convertStateFromStore` +`store.Draft→State_DRAFT`; `convertStateToStore` +`State_DRAFT→store.Draft`, default stays `Normal`).
- Modify: `server/router/mcp/api_helpers.go:24–29` (`rowStatusToProto` +`Draft`).
- Modify: `server/router/api/v1/memo_service.go:87–92` (read `request.Memo.State` → `create.RowStatus`; `UNSPECIFIED`→`Normal`, E1/C2).
- Modify: `server/router/api/v1/memo_service.go:160,166,175` (guard webhook/SSE/mentions on `RowStatus==Draft`).
- Modify: `server/router/api/v1/memo_service.go:191–202` (add `STATE_DRAFT` branch, creator-only, mirror archived guard).
- Modify: `server/router/api/v1/memo_service.go:518–520` + publish detection (transition `prev==Draft && new==NORMAL` → refresh `CreatedTs`+`UpdatedTs`; else untouched, E5/O4).
- Modify: `server/router/api/v1/memo_update_helpers.go:65–78` (`dispatchMemoUpdatedSideEffects`: suppress while staying `Draft`; fire on publish).

**Implementation**: Follow design §4 exactly. Use `errors.Wrap` (not `fmt.Errorf`); gRPC errors via `status.Errorf(codes.X, …)`. The `ListMemos` DRAFT branch must be byte-for-byte the archived creator-guard shape (`currentUser==nil → empty`, `memoFind.CreatorID=&currentUser.ID`). Publish detection must key on the *transition*, loading the prior `row_status` to compare — not merely "state in `update_mask.paths`".

**Boundaries**: Must NOT add an `acl_config.go` entry (drafts are never public). Must NOT change `CreateMemoRequest`/`UpdateMemoRequest` proto. Must NOT alter the password/comment paths. Must NOT touch leakage surfaces beyond the converters here (that is T8).

**Dependencies**: T1, T4, T6.

**Expected Outcome**: T4 items 1,2,4,6,7 (and the create-side of 3/5) go green.

**Validation**:
- `DRIVER=sqlite go test ./server/router/api/v1/... -run 'Draft' -race -count=1 -v` — expects the handler/converter/publish set PASS.
- `DRIVER=sqlite go test ./store/test/ -run TestMemoPublishRefreshesCreatedTs -count=1` — expects PASS (publish timestamp, O4).
- `golangci-lint run ./server/...` — expects clean.

---

### T8: Leakage exclusion discipline → greens T4 leakage [L]

**Objective**: Guarantee a `DRAFT` memo is invisible on every non-creator surface (G3; design §5; audit §6 Phase-3 leak list).

**Size**: L (≈7 added guards + ≈5 verify-only confirmations across distinct subsystems).

**Files**:
- Modify (add `Draft` guard, mirror `Archived`): `server/router/api/v1/memo_service.go:42–71` (`checkMemoReadAccess`, creator-only regardless of visibility — critical, E2/E3); `server/router/mcp/access.go:17–35` (`checkMemoAccess`); `server/router/mcp/access.go:49–64` (`applyVisibilityFilter`, constrain out `Draft` when `rowStatus` nil); `server/router/frontend/frontend.go:150–152` (sitemap → `RowStatus:&Normal`); `server/router/api/v1/memo_relation_service.go:108–112` (exclude `Draft`); `server/runner/memopayload/runner.go:35` (skip/exclude `Draft`); `server/router/api/v1/reaction_service.go` (suppress parent-`Draft` broadcast to non-creator).
- Verify-only (change nothing, prove with the T4 regression tests): `server/router/.../rss.go:89,140`; `server/router/mcp/tools_memo.go:274,467`; `server/router/api/v1/user_service_stats.go:208`; default `ListMemos`; `web/src/components/PagedMemoList/PagedMemoList.tsx:92–100`.

**Implementation**: Each added guard mirrors the existing `Archived` guard in the same function (same error code/shape). For nil-`rowStatus` query paths, add an explicit `Draft` exclusion rather than relying on an implicit default. Touch only the leakage seams; no behavior change to creator-scoped paths.

**Boundaries**: Must NOT alter the verify-only surfaces (a diff there is a regression). Must NOT make any draft surface public. Must NOT broaden guards to also affect `Archived`/`Normal`.

**Dependencies**: T1, T4, T7.

**Expected Outcome**: All T4 item-8 leakage regressions pass; the verify-only surfaces remain green with zero diff.

**Validation**:
- `DRIVER=sqlite go test ./server/router/api/v1/... ./server/router/mcp/... -run 'Draft.*Leak|Leak.*Draft' -race -count=1 -v` — expects all PASS.
- `git diff --stat` on the verify-only files — expects **no** changes.
- `golangci-lint run ./server/...` — expects clean.

---

### T9: Frontend `saveDraft` + `useDrafts` + wiring → greens T5 [L]

**Objective**: Add the durable-draft save path, the drafts query, and the editor/toolbar affordances (design §6; G2). **UI layout — user-directed 2026-05-17, supersedes the contract §5.2 / earlier split-button design:** the toolbar gets **two separate adjacent buttons** `[Save] [▾]` (the `▾` is its *own* `variant="outline" size="icon"` button — NOT a segmented split of Save — opening a `DropdownMenu` whose single item is "Save as draft"), **plus a separate "load previous drafts" icon button in the toolbar's LEFT cluster** next to the `+` InsertMenu, opening a **scrollable `DropdownMenu`** that lists the user's drafts. O1/O3 resolved (explicit dropdown action, not per-keystroke autosave; fetch-into-fresh-editor, no `EditorState` change).

**Size**: L (2 new functions + 2 toolbar affordances + drafts-list menu + index handlers; reuses existing builders/primitives).

**Files**:
- Modify: `web/src/components/MemoEditor/services/memoService.ts` (near `:77`) — add `saveDraft`.
- Modify: `web/src/hooks/useMemoQueries.ts` (near `:111`) — add `useDrafts`.
- Modify: `web/src/components/MemoEditor/types/components.ts` — **anchor correction:** `EditorToolbarProps` lives here (the `types/` dir), not `state/types.ts`. Add `onSaveDraft?: () => void` and `onLoadDrafts?: () => ReactNode`.
- Modify: `web/src/components/MemoEditor/components/EditorToolbar.tsx` (`EditorToolbar` def `:10`, primary `<Button onClick={onSave}>` `:51`) — keep Save unchanged; add a **separate** adjacent `variant="outline" size="icon"` button with `ChevronDownIcon` (lucide-react) as a `DropdownMenuTrigger` → one `DropdownMenuItem` "Save as draft" → `onSaveDraft`; add a **separate** left-cluster `HistoryIcon` "load previous drafts" button (cluster gets `gap-1`) whose `DropdownMenuContent` renders `onLoadDrafts()`. Both affordances render only when their handler prop is defined.
- Modify: `web/src/components/MemoEditor/index.tsx` — add `handleSaveDraft` as a sibling of `handleSave` (`:236`); add `handleResumeDraft`; render an internal non-exported `DraftsListMenu`; pass `onSaveDraft`/`onLoadDrafts` where `<EditorToolbar onSave={handleSave} … />` is rendered (**anchor correction:** render site is `~:479`, not `:348`). `handleSaveDraft` calls `saveDraft`, then `discardDraft()` (`:257`), then the same `invalidateQueries` set as `handleSave` (`:260–275`).
- Modify: `web/src/locales/en.json` — add `editor.save-as-draft`, `editor.load-drafts`, `editor.loading`, `editor.no-drafts`.
- Reuse (no new component): `@/components/ui/dropdown-menu` — the shared Radix primitive already used by `UserMenu`/`MemoActionMenu`.
- **Not modified** (O3 resolved — fetch-into-fresh-editor): `web/src/components/MemoEditor/state/types.ts` stays zero-diff; no `editingDraftName?` field.

**Implementation**: `saveDraft` reuses `save()`'s exact `create(MemoSchema, {...})` builder, adding `state: State.DRAFT` as the only delta; `createMemo` for a new draft, `updateMemo` (mask incl. `state` held `DRAFT`) when `options.draftMemoName` is set (a resumed draft updates in place, not a duplicate); it must **not** gate on `validationService.canSave` (E4); on success it clears the matching `cacheService` key (E7). **`useDrafts` mirrors `useInfiniteMemos`, NOT `useMemos`** (user-directed): a `useInfiniteQuery` with `queryKey: memoKeys.list({...request, state: State.DRAFT})`, fixed **`pageSize: 20`**, `initialPageParam:""`, `getNextPageParam: (last) => last.nextPageToken || undefined`. The **drafts list is a scrollable `DropdownMenu`**: `DropdownMenuContent` body is a `max-h-[60vh] overflow-y-auto` scroll box driven by `useDrafts({ pageSize: 20 })`, with **container-scoped infinite scroll** via an `IntersectionObserver` sentinel (`root: scrollRef`, NOT window) that calls `fetchNextPage` — `PagedMemoList` is deliberately **not** reused (its infinite scroll is window-based and cannot drive a fixed-height container). Resume = row click → `memoServiceClient.getMemo({name})` → `memoService.fromMemo` → `dispatch(initMemo(...))` (the existing existing-memo load path; `EditorState` not extended); the resumed name is tracked in component-local state and passed back as `saveDraft`'s `options.draftMemoName`. Gated `isDraftCacheEnabled && !parentMemoName` (v1 = new-memo drafts only, E13).

**Boundaries**: Must NOT add a new route/page or a new hook pattern beyond `useDrafts` (G4). Must NOT make every keystroke a server write (O1). Must NOT remove or rewrite `cacheService`. `state/types.ts` zero-diff.

**Dependencies**: T1, T5, T7 (server must accept/return `DRAFT`).

**Expected Outcome**: T5's 16 draft tests pass; the 7 regression pins stay green.

**Validation**:
- `cd web && pnpm test --run` (the 3 draft test files) — expects 16/16 PASS.
- `cd web && pnpm lint` — expects clean (tsc + Biome).

---

### T10: Gate sweep + manual end-to-end pass [S]

**Objective**: Confirm all repo gates and the human-verifiable end-to-end path (audit §8.5).

**Size**: S (run gates; scripted manual pass).

**Files**: None (verification only).

**Implementation**: Run every gate; perform the manual pass.

**Boundaries**: Must NOT "fix forward" by weakening a test — a red here routes back to the owning task.

**Dependencies**: T1–T9.

**Expected Outcome**: All gates green; manual path verified.

**Validation**:
- `go test ./...` — PASS. `golangci-lint run` — clean (note: `errors.Wrap` not `fmt.Errorf`; gRPC `status.Errorf`). `go mod tidy -go=1.26.2` — clean diff.
- `cd proto && buf lint && buf format -d` — clean. `cd web && pnpm lint && pnpm test` — PASS.
- `DRIVER=sqlite go test ./server/... -race -count=1` and `go test ./store/...` (full driver matrix in CI) — PASS.
- Manual: compose → **Save draft** → clear `localStorage` (simulate other device) → draft still listed via Drafts (`useDrafts`) → resume → **publish** → memo appears in default feed + fires webhook/SSE exactly once, `created_ts` refreshed, disappears from Drafts.

## Out-of-Scope Tasks

Explicitly deferred per `definition.md` / `design.md`; not attempted in this execution:

- "Draft an edit to an already-published memo" (E13 / O4-scope) — v1 is new-memo drafts only, matching `isDraftCacheEnabled = !memo`.
- Comments on drafts (`CreateMemoComment`) and `Draft → ARCHIVED` direct transitions (E6/E11 / O2).
- Option B (`is_draft` column), Option C (JSON-blob drafts), alternative D (`MemoPayload.draft`).
- Any `acl_config.go` / public-endpoint exposure of drafts.
- MySQL/Postgres migration files or `LATEST.sql` edits (C3 — no CHECK to relax).
- A new "Drafts" page/route, or any new hook pattern beyond `useDrafts` (itself a `useInfiniteMemos` analogue). The drafts list is a scrollable `DropdownMenu` reusing the shared `@/components/ui/dropdown-menu` primitive — `PagedMemoList` is intentionally *not* reused (window-scroll infinite scroll cannot drive a fixed-height dropdown).
- Backfilling existing `localStorage` caches into server drafts.
- `editingDraftName` on `EditorState` — out of scope (O3 resolved: fetch-into-fresh-editor; `state/types.ts` unchanged).
- Per-keystroke server autosave for drafts — out of scope (O1 resolved: explicit button + debounce; `cacheService` remains the keystroke buffer).
- Running MySQL/Postgres integration tests locally (validation commands use SQLite, the default `DRIVER`; the full driver matrix runs in CI).

## Edge Cases & Test Coverage (as built)

Every edge case from `aurum-systems/04-implementation-contract.md` §7, each with
its concrete guard and the test(s) that pin it. Authored as failing tests
*before* the implementing task (G6); all green at T10 unless marked "scope".

| ID | Edge case | Guard (as built) | Pinned by |
|---|---|---|---|
| E1 | `STATE_UNSPECIFIED` on create must stay `NORMAL` | `convertStateToStore` default arm → `store.Normal`; `CreateMemo` only drafts on explicit `State_DRAFT` (T7) | `TestCreateMemo_UnspecifiedStateIsNormal`; `TestConvertStateDraftRoundTrip` (default subtest) |
| E2 | Draft with `PUBLIC`/`PROTECTED` visibility still creator-only | `checkMemoReadAccess` `Draft` guard placed *before* visibility logic — state overrides visibility (T8) | `TestGetMemo_DraftIsCreatorOnlyRegardlessOfVisibility` |
| E3 | Attacker guesses a draft UID via `GetMemo`/MCP | same `checkMemoReadAccess` guard + MCP `checkMemoAccess` (T8) | `TestGetMemo_DraftIsCreatorOnlyRegardlessOfVisibility`, `TestMCPGetMemoAndReadResourceDenyDraftToNonCreator` |
| E4 | Empty/partial draft must bypass the save-validation gate | `memoService.saveDraft` does **not** call `validationService.canSave` (T9) | web: `saveDraft … does NOT require validationService.canSave` |
| E5 | Publish refreshes `created_ts`; a plain `NORMAL` edit must not | `UpdateMemo` keys on the *transition* `prev==Draft && new==NORMAL` (T7); `dispatchMemoUpdatedSideEffects` suppresses while Draft (T7) | `TestUpdateMemo_PublishDraftRefreshesTimestampsAndFiresSideEffects`, `TestUpdateMemo_NormalContentEditDoesNotRefreshCreatedTs`, store `TestMemoPublishRefreshesCreatedTs` / `TestMemoNormalEditDoesNotTouchCreatedTs` |
| E6 | `Draft → ARCHIVED` directly | **scope**: disallowed v1 (O2) — no transition path; Non-Goal | (design boundary; no path exists) |
| E7 | localStorage draft *and* server draft both exist | `saveDraft` success clears the `cacheService` key; `handleSaveDraft` → `discardDraft()` (T9) | web: `saveDraft … clears matching cacheService key on success (E7)` |
| E8 | Autosave write-storm if every keystroke hit the server | **O1 resolved**: explicit dropdown action only; `cacheService` remains the 500ms keystroke buffer; no per-keystroke server write wired (T9) | design boundary (absence of autosave→server wiring; G4) |
| E9 | SQLite-only `0.29` dir, no parallel mysql/pg `0.29` | per-driver `GetCurrentSchemaVersion` glob tolerates divergence; SQLite max ⇒ `0.29.1` (T1) | `TestMemoDraftSchemaVersionRecognizesSqliteOnly029` |
| E10 | Driver silently drops `row_status` on create (**C4**, highest risk) | all 3 drivers' `CreateMemo` conditionally emit `row_status` when set (T6) | `TestMemoDraftCreateAndReadBack` (RED pre-T6 → GREEN post-T6) |
| E11 | Comment on / relation to a draft | **scope**: comments-on-draft disallowed v1 (O2, Non-Goal); a relation pointing at a draft must not surface it to a non-creator → `memoRelationHidesDraft` skip (T8) | `TestListMemoRelations_ExcludesDraftFromNonCreator` |
| E12 | `convertStateToStore` default→`Normal` could swallow an unmapped `DRAFT` | explicit `DRAFT` cases both directions in v1 + MCP converters (T7) | `TestConvertStateDraftRoundTrip` (+subtests), `TestRowStatusToProtoDraft`, `TestParseRowStatusDraft` |
| E13 | Resume a *published* memo's editor (v1 = new-memo drafts only) | drafts affordances gated `isDraftCacheEnabled && !parentMemoName` — matches the existing `isDraftCacheEnabled=!memo` gate (T9) | scope gate (covered by the gating condition; resume path only loads `DRAFT` rows) |

### Zero-leakage surfaces (G3) and their pins

`checkMemoReadAccess` → `TestGetMemo_DraftIsCreatorOnlyRegardlessOfVisibility` ·
default `ListMemos` → `TestListMemos_DefaultExcludesDraft` ·
`ListMemos{state:DRAFT}` (creator-only / unauth→empty, not error) →
`TestListMemos_DraftStateIsCreatorOnly` · relations →
`TestListMemoRelations_ExcludesDraftFromNonCreator` · reactions →
`TestListMemoReactions_DraftIsCreatorOnly` · MCP access/read-resource →
`TestMCPGetMemoAndReadResourceDenyDraftToNonCreator` · MCP list →
`TestMCPListMemosDraftIsCreatorOnly` (+ pins
`TestMCPListMemosDefaultExcludesDraftRegressionPin`,
`TestMCPSearchMemosExcludesDraftRegressionPin`) · sitemap →
`TestFrontendService_SitemapExcludesDraft` · payload runner →
`TestPayloadRunner_SkipsDraftMemos` · user stats →
`TestUserStatsExcludesDraftRegressionPin` · RSS → verify-only
(`rss.go` already explicit-NORMAL, kept zero-diff). Create-time side-effect
suppression (G5: webhook/SSE/mention) →
`TestCreateMemo_DraftPersistsAndSuppressesSideEffects` (SSE + mention-inbox
proxies; webhook is a sibling call on the same gated path — see `execution.md`
T4 harness note).

### Open decisions & user-surfaced questions — resolutions

| ID | Question | Resolution (as built) | Pinned by |
|---|---|---|---|
| O1 | localStorage coexistence | Explicit "Save as draft" dropdown action; `cacheService` stays the keystroke buffer, cleared on server-draft success | E7/E8 rows |
| O2 | Comments-on-draft / `Draft→ARCHIVED` | Both disallowed v1 (Non-Goals) | E6/E11 |
| O3 | Resume scope | Fetch-into-fresh-editor; `state/types.ts` zero-diff (no `editingDraftName`) | T9 zero-diff check |
| O4 | Publish timestamp behavior | `DRAFT→NORMAL` refreshes `created_ts`+`updated_ts`; plain `NORMAL` edit does not | E5 row |
| UD-1 | **Pagination / page size** (was unspecified) | `useDrafts` bakes a fixed **`pageSize: 20`** into the `ListMemosRequest` | web: `useDrafts issues ListMemos state=DRAFT, pageSize:20` |
| UD-2 | **Scrollable drafts container** (was unspecified) | Drafts `DropdownMenuContent` body is a fixed **`max-h-[60vh] overflow-y-auto`** scroll box (independently scrollable; does not hijack the page) | web: editor-toolbar load-drafts render tests |
| UD-3 | **Infinite scroll vs. paging** (was unspecified) | Infinite scroll: `useDrafts` mirrors `useInfiniteMemos`; an `IntersectionObserver` sentinel scoped to the dropdown's scroll container (`root: scrollRef`, **not** window) drives `fetchNextPage` | web: `useDrafts is useInfiniteQuery (fetchNextPage/hasNextPage)` |
| UD-4 | **Rate limiting on `ListMemos?state=DRAFT`** (was unspecified) | **No new/separate limiter.** The DRAFT branch reuses the existing authenticated, creator-scoped `ListMemos` handler + middleware (unauthenticated ⇒ empty list, not error), so it inherits the existing endpoint's request handling exactly; no new public surface, no `acl_config.go` entry (consistent with G3/G4 and the "no public draft endpoint" Non-Goal) | `TestListMemos_DraftStateIsCreatorOnly` (creator-scoping + unauth→empty) |
