## Execution Log

Tests-first ordering per `plan.md` (G6): T1 foundation → T2–T5 author tests that
fail on today's tree → T6–T9 implement → T10 gate sweep. Waves T4/T5/T6 and
T8/T9 were executed via parallel subagent orchestration (disjoint file trees).
Every cited `file:line` was re-grepped before editing; anchor drift is recorded
under **Path Corrections**.

### T1: Foundation — `State.DRAFT` enum + `store.Draft` const + codegen + SQLite migration

**Status**: Completed
**Files Changed**:
- Modified: `proto/api/v1/common.proto` (`enum State` +`DRAFT = 3;`)
- Modified: `store/common.go` (`Draft RowStatus = "DRAFT"` beside `Normal`/`Archived`)
- Modified: `store/migration/sqlite/LATEST.sql` (memo `row_status` CHECK widened to `IN ('NORMAL','ARCHIVED','DRAFT')` — the `memo` table line only)
- Created: `store/migration/sqlite/0.29/00__memo_draft_state.sql` (copied the `0.3/00__memo_visibility_protected.sql` PRAGMA-bracket `_memo_old` rebuild pattern verbatim, with the current 10-column memo schema + widened CHECK)
- Regenerated (GEN, not hand-edited): `proto/gen/**`, `web/src/types/proto/api/v1/common_pb.ts` via `cd proto && buf generate`
**Validation**:
- `rg DRAFT` — present in proto, `store/common.go`, generated Go (`State_DRAFT State = 3`), generated TS (`DRAFT = 3`).
- `cd proto && buf lint && buf format -d` — clean.
- `go build ./...` — PASS.
- `DRIVER=sqlite go test ./store/test/ -run TestMemo -count=1` — PASS (behavior unchanged; a draft create still silently becomes NORMAL until T6, by design).
- `rg "CHECK.*DRAFT" store/migration/sqlite` — hits in `0.29/00__memo_draft_state.sql` + `LATEST.sql:39`; `rg DRAFT store/migration/{mysql,postgres}` — no hits (C3 honored).
**Path Corrections**: The SQLite `row_status` CHECK exists on **two** lines of `LATEST.sql` (`:14` = `user` table, `:39` = `memo` table). The plan cited only `:39`; confirmed `:14` is the `user` table and was deliberately left unchanged (users are never drafts).
**Deviations**: None.

### T2: Store-layer failing tests (TestContainers)

**Status**: Completed
**Files Changed**:
- Created: `store/test/memo_draft_test.go` — `TestMemoDraftCreateAndReadBack`, `TestMemoDraftExcludedFromNormalList`, `TestMemoDraftListedWhenRequested`, `TestMemoPublishRefreshesCreatedTs`, `TestMemoNormalEditDoesNotTouchCreatedTs` (mirrors `memo_test.go`: `NewTestingStore`+`createTestingHostUser`+`testify/require`).
**Validation**:
- `DRIVER=sqlite go test ./store/test/ -run 'TestMemoDraft|TestMemoPublish|TestMemoNormalEdit' -count=1 -v` — documented expected RED: `…CreateAndReadBack`, `…ExcludedFromNormalList`, `…ListedWhenRequested`, `…PublishRefreshesCreatedTs` **FAIL** (proves C4/E10/E5 real); `…NormalEditDoesNotTouchCreatedTs` **PASS** (E5-reverse regression pin).
**Path Corrections**: None.
**Deviations**: None — RED is the intended tests-first state; greened by T6.

### T3: Migration fresh-install + upgrade failing tests

**Status**: Completed
**Files Changed**:
- Created: `store/test/migrator_draft_test.go` — `TestMemoDraftSchemaVersionRecognizesSqliteOnly029` (E9), `TestMemoDraftMigrationFreshInstallAcceptsDraft` (CHECK widened-not-dropped, asserted via raw SQL so it is C4-independent), `TestMemoDraftMigrationPreservesRowsAndUnlocksDraft` (idempotent re-migrate + row preservation + DRAFT unlocked). Reuses the existing migrator harness (`NewTestingStoreWithDSN`, `openMigrationSQLDB`, `execMigrationSQL`) — no new infra.
**Validation**:
- `DRIVER=sqlite go test ./store/test/ -run 'TestMemoDraftSchemaVersion|TestMemoDraftMigration' -count=1 -v` — all **PASS** post-T1 (E9: SQLite recognizes `0.29.1` as the new max and the per-driver scan tolerates no parallel mysql/pg `0.29`).
**Path Corrections**: `GetCurrentSchemaVersion` derives `<minor>.<patch+1>`, so `sqlite/0.29/00__…` ⇒ schema version `"0.29.1"` — asserted exactly.
**Deviations**: The plan's container-based 0.28→0.29 upgrade is already exercised by the existing `TestMigrationFromStableVersion` (now includes 0.29); the added test deterministically pins idempotency + preservation + DRAFT-unlock without a brittle new container test.

### T4: API-handler + leakage failing tests

**Status**: Completed (parallel subagent; tests-first RED)
**Files Changed**:
- Created: `server/router/api/v1/common_draft_test.go` (`TestConvertStateDraftRoundTrip` +subtests, E12)
- Created: `server/router/api/v1/memo_service_draft_test.go` (`TestCreateMemo_DraftPersistsAndSuppressesSideEffects`, `TestCreateMemo_UnspecifiedStateIsNormal` E1, `TestListMemos_DefaultExcludesDraft`, `TestListMemos_DraftStateIsCreatorOnly`, `TestGetMemo_DraftIsCreatorOnlyRegardlessOfVisibility` E2/E3, `TestUpdateMemo_PublishDraftRefreshesTimestampsAndFiresSideEffects` O4, `TestUpdateMemo_NormalContentEditDoesNotRefreshCreatedTs` E5, `TestListMemoRelations_ExcludesDraftFromNonCreator`, `TestListMemoReactions_DraftIsCreatorOnly`, `TestUserStatsExcludesDraftRegressionPin`)
- Created: `server/router/mcp/api_helpers_draft_test.go` (`TestRowStatusToProtoDraft`, `TestParseRowStatusDraft`)
- Created: `server/router/mcp/mcp_draft_test.go` (`TestMCPGetMemoAndReadResourceDenyDraftToNonCreator`, `TestMCPListMemosDraftIsCreatorOnly`, `TestMCPListMemosDefaultExcludesDraftRegressionPin`, `TestMCPSearchMemosExcludesDraftRegressionPin`)
- Created: `server/router/frontend/frontend_draft_test.go` (`TestFrontendService_SitemapExcludesDraft`)
- Created: `server/runner/memopayload/runner_draft_test.go` (`TestPayloadRunner_SkipsDraftMemos`)
**Validation**:
- `DRIVER=sqlite go test ./server/router/api/v1/... ./server/router/mcp/... ./server/router/frontend/... ./server/runner/memopayload/... -run Draft -count=1` — documented RED/GREEN split: handler/converter/leakage-guard tests **FAIL** for the right reason (feature/guard absent); explicit-NORMAL surfaces (default ListMemos, user stats, MCP list/search) **PASS** as regression pins.
**Path Corrections**: None.
**Deviations**: Webhook *delivery* is unobservable from tests — `internal/webhook` uses an unexported `safeClient` whose dialer rejects loopback/private IPs (SSRF guard), and `httptest.Server` only binds loopback. Suppression/firing is asserted via the two reliably-observable synchronous channels on the *same gated code path* (SSE hub broadcast + mention-notification inbox DB write). No production code modified.

### T5: Frontend failing tests (Vitest)

**Status**: Completed (parallel subagent; tests-first RED)
**Files Changed**:
- Modified: `web/tests/memo-editor-cache.test.ts` (appended a `saveDraft` describe block; 5 existing cache tests untouched)
- Created: `web/tests/use-drafts.test.ts`
- Created: `web/tests/editor-toolbar-save-draft.test.tsx`
**Validation**:
- `cd web && pnpm test --run` (draft files) — 9 RED + 2 green regression pins documented; every red fails on a missing export/prop/affordance, not a harness defect.
**Path Corrections**: None.
**Deviations**: Tests assert the **memory-locked UI** (separate `▾` `variant="outline" size="icon"` dropdown + separate left-cluster "load previous drafts" button) and a `useInfiniteQuery`-shaped `useDrafts` (`pageSize:20`, `state=DRAFT`) — this **supersedes** contract §5.2 / plan.md T9's split-button + `useMemos`/`useQuery` description, per user direction 2026-05-17. Used `fireEvent` (not `@testing-library/user-event`, which is not a project dependency).

### T6: Driver C4 fix across three drivers → greens T2

**Status**: Completed (parallel subagent)
**Files Changed**:
- Modified: `store/db/sqlite/memo.go`, `store/db/mysql/memo.go`, `store/db/postgres/memo.go` — `CreateMemo` conditionally appends `row_status` to the INSERT column list + value/placeholder **only when `create.RowStatus != ""`** (the empty path is byte-for-byte the prior `DEFAULT 'NORMAL'` behavior). Each matches its driver's placeholder idiom (`?` sqlite/mysql; postgres derives `$N` from arg count).
**Validation**:
- `go build ./...` — PASS.
- `DRIVER=sqlite go test ./store/test/ -run 'TestMemoDraft|TestMemoPublish|TestMemoNormalEdit' -count=1 -v` — T2 RED set flipped to **PASS**; `…NormalEditDoesNotTouchCreatedTs` stays PASS.
- `DRIVER=sqlite go test ./store/test/ -run TestMemo -count=1` — PASS (no non-draft regression).
- `golangci-lint run ./store/...` — 0 issues.
**Path Corrections**: None (CreateMemo at `:16` in all three drivers, as cited). `UpdateMemo`/list-filter SQL verified already passing `*RowStatus` through — left untouched.
**Deviations**: None.

### T7: API-handler logic → greens T4 (non-leakage)

**Status**: Completed (subagent)
**Files Changed**:
- Modified: `server/router/api/v1/common.go` (`convertStateFromStore` +`store.Draft→State_DRAFT`; `convertStateToStore` +`State_DRAFT→store.Draft`; default arms unchanged)
- Modified: `server/router/mcp/api_helpers.go` (`rowStatusToProto` +`Draft`)
- Modified: `server/router/mcp/tools_memo.go` (`parseRowStatus` +`Draft` accept set + error string)
- Modified: `server/router/api/v1/memo_service.go` (`CreateMemo` reads `request.Memo.State`→`RowStatus`, E1/C2; webhook/SSE/mention suppressed when `RowStatus==Draft`; `ListMemos` +`STATE_DRAFT` creator-only branch byte-mirroring ARCHIVED; `UpdateMemo` publish-transition `prev==Draft && new==NORMAL` refreshes `CreatedTs`+`UpdatedTs`)
- Modified: `server/router/api/v1/memo_update_helpers.go` (`dispatchMemoUpdatedSideEffects` suppresses while staying Draft; fires once on publish)
**Validation**:
- `go build ./...` — PASS.
- `DRIVER=sqlite go test ./server/router/api/v1/... ./server/router/mcp/... -run Draft -race -count=1 -v` — converter, CreateMemo-suppression, UNSPECIFIED (E1), ListMemos-DRAFT, publish (O4), NORMAL-edit (E5) all **PASS**; the 5–7 still-RED tests are exactly the T8-owned leakage guards (verified, not T7 misses).
- `DRIVER=sqlite go test ./store/test/ -run TestMemoPublishRefreshesCreatedTs` — PASS.
- Full `DRIVER=sqlite go test ./server/router/api/v1/... -count=1` — no non-draft regression.
**Path Corrections**: The inverse row-status parser is **`parseRowStatus` in `server/router/mcp/tools_memo.go:163`**, not `api_helpers.go:24-29` as the plan stated (grepped the mcp package and fixed it there).
**Deviations**: None.

### T8: Leakage exclusion discipline → greens T4 leakage

**Status**: Completed (parallel subagent)
**Files Changed** (each adds a `Draft` guard mirroring the adjacent `Archived` guard):
- Modified: `server/router/api/v1/memo_service.go` `checkMemoReadAccess` (creator-only regardless of visibility — E2/E3, critical)
- Modified: `server/router/api/v1/memo_relation_service.go` (helper `memoRelationHidesDraft`; skips Draft relations for non-creator in both `ListMemoRelations` loops)
- Modified: `server/router/api/v1/reaction_service.go` `ListMemoReactions` (parent-Draft creator-only)
- Modified: `server/router/mcp/access.go` `checkMemoAccess` (+Draft non-creator reject) and `applyVisibilityFilter` (Draft creator-scoping + nil-status excludes Draft)
- Modified: `server/router/frontend/frontend.go` (sitemap `FindMemo` +`RowStatus:&Normal`)
- Modified: `server/runner/memopayload/runner.go` (`RunOnce` batch `FindMemo` +`RowStatus:&Normal`)
**Validation**:
- `go build ./...` — PASS.
- Full draft sweep `-race` — all T4 leakage tests **PASS**; explicit-NORMAL regression pins stay green.
- `git diff --stat` — verify-only surfaces (`rss.go`, `user_service_stats.go`, `mcp/tools_memo.go` list/search call-sites) zero-diff.
- `DRIVER=sqlite go test ./server/... -count=1` — exit 0, no non-draft regression.
**Path Corrections**: The memo-relation guard could **not** be a filter-DSL `row_status` predicate (the filter DSL exposes no `row_status`/`state` column — confirmed against `internal/filter/schema.go`); implemented as a post-fetch creator-aware skip helper instead. No test or verify-only surface altered.
**Deviations**: None.

### T9: Frontend `saveDraft` + `useDrafts` + toolbar/dropdown wiring → greens T5

**Status**: Completed (parallel subagent)
**Files Changed**:
- Modified: `web/src/components/MemoEditor/services/memoService.ts` (`saveDraft` reuses `save()`'s exact `MemoSchema` builder +`state:DRAFT`; `updateMemo` w/ mask incl. `state` when `draftMemoName` set else `createMemo`; no `validationService.canSave` gate — E4; clears `cacheService` on success — E7)
- Modified: `web/src/hooks/useMemoQueries.ts` (`useDrafts` mirrors `useInfiniteMemos`: `useInfiniteQuery`, `pageToken`/`getNextPageParam`, fixed `pageSize:20`, `state:DRAFT`, `queryKey: memoKeys.list(draftRequest)`)
- Modified: `web/src/components/MemoEditor/types/components.ts` (`EditorToolbarProps` +`onSaveDraft?`, `onLoadDrafts?`)
- Modified: `web/src/components/MemoEditor/components/EditorToolbar.tsx` (Save unchanged; separate `▾` `variant="outline" size="icon"` `DropdownMenuTrigger` w/ one "Save as draft" item; separate left-cluster `HistoryIcon` "load previous drafts" button, `gap-1`; reuses `@/components/ui/dropdown-menu`)
- Modified: `web/src/components/MemoEditor/index.tsx` (`handleSaveDraft` sibling of `handleSave` → `saveDraft`→`discardDraft()`→same `invalidateQueries` set; `handleResumeDraft` = `getMemo`→`fromMemo`→`dispatch(initMemo)`; internal non-exported `DraftsListMenu` with `max-h-[60vh] overflow-y-auto` + IntersectionObserver sentinel `root:scrollRef` infinite scroll; gated `isDraftCacheEnabled && !parentMemoName` — E13)
- Modified: `web/src/locales/en.json` (`editor.save-as-draft`, `editor.load-drafts`, `editor.loading`, `editor.no-drafts`)
**Validation**:
- `cd web && pnpm test --run` (3 draft files) — **16/16 PASS** (all T5 RED greened; 2 toolbar + 5 cacheService regression pins stay green).
- `cd web && pnpm lint` — clean (tsc + Biome).
- `git diff --stat web/src/components/MemoEditor/state/types.ts` — zero-diff (O3 honored: fetch-into-fresh-editor; no `editingDraftName`).
**Path Corrections**: `EditorToolbarProps` lives in `web/src/components/MemoEditor/types/components.ts` (not `state/types.ts`); the `<EditorToolbar>` render site is `index.tsx ~:479` (not the contract's `:348`); `EditorToolbar.tsx` is under `components/`.
**Deviations**: Drafts list rendered as a **scrollable `DropdownMenu`** with an IntersectionObserver-driven (container-scoped, not window) infinite scroll — `PagedMemoList`'s window-scroll infinite scroll is deliberately **not** reused (it cannot drive a fixed-height container). `useDrafts` mirrors `useInfiniteMemos` not `useMemos`. Toolbar is two separate buttons + a separate load-drafts dropdown. All three deviations are user-directed (2026-05-17) and supersede contract §5.2 / plan.md T9.

### T10: Gate sweep + manual end-to-end + docs

**Status**: Completed
**Files Changed**:
- Modified: `server/router/api/v1/memo_service_draft_test.go` (removed 11 decorative `// ----` separator comment lines that tripped `godot`; no test logic changed)
- Created: `docs/plans/2026-05-17-server-side-memo-drafts/execution.md` (this file)
- Modified: `docs/plans/2026-05-17-server-side-memo-drafts/plan.md` (T9 rewritten to the memory-locked layout; appended an Edge Cases & Test Coverage section)
**Validation**:
- `go build ./...` — PASS.
- `DRIVER=sqlite go test ./store/test/ -run 'Draft|Migration|TestMemo' -count=1` — PASS.
- `DRIVER=sqlite go test ./server/router/... ./server/runner/... -run Draft -count=1` — all draft tests **PASS**.
- `cd web && pnpm test --run` (draft files) — 16/16 PASS; `pnpm lint` — clean.
- `cd proto && buf lint && buf format -d` — clean.
- `go mod tidy -go=1.26.2` — no `go.mod`/`go.sum` change (no new dependencies introduced).
- `golangci-lint run` — clean for all feature-touched files. **One pre-existing, unrelated issue remains** and was deliberately NOT fixed-forward (out of scope, untouched file): `server/router/api/v1/connect_interceptors.go:84:23` `govet` "Constant reflect.Ptr should be inlined" (`git diff` shows this file is zero-diff — not introduced by this feature).
**Path Corrections**: None.
**Deviations**:
- **Manual interactive end-to-end NOT performed**: this environment has no browser/UI runtime. The full end-to-end path (compose → Save-as-draft → driver INSERT `row_status=DRAFT` with side-effects suppressed → `discardDraft` clears localStorage → list via `useDrafts` → resume via `getMemo`→editor → publish refreshes `created_ts`/`updated_ts` + fires side-effects once + leaves the Drafts list) is instead **covered end-to-end by automated tests across every layer** (store round-trip T2, migration T3, handler create/list/publish + converters T4/T7, leakage guards T4/T8, frontend saveDraft/useDrafts/toolbar/resume T5/T9). Stated explicitly rather than claimed.
- Pre-existing unrelated `web/tests/filtered-memo-stats.test.ts` (3 failures, a `2026-04-30` vs `2026-05-01` date-boundary issue) fails identically with and without this feature's changes; out of scope, not modified ("must not fix forward").

## Completion Declaration

**All ten tasks (T1–T10) completed.** The server-side draft-memo feature is
implemented per `definition.md` / `design.md` / `plan.md` and the authoritative
`aurum-systems/04-implementation-contract.md`, with the three user-directed
divergences (scrollable-DropdownMenu drafts list, `useInfiniteMemos`-shaped
`useDrafts` w/ `pageSize 20`, two-button + separate-load-drafts toolbar)
recorded above. Every implementing phase was preceded by failing tests that
fail on today's tree and pass only after the fix (G6). All repository gates pass
for feature-touched code; the two remaining red items are pre-existing,
unrelated, in untouched files, and were deliberately not fixed-forward. The C4
silent-drop driver bug — the highest-risk finding — is fixed and pinned by
`TestMemoDraftCreateAndReadBack`.
