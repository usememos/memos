# Bugfix — Publishing a resumed draft orphans the draft and duplicates it onto Home

**Status: RESOLVED — 2026-05-17 (user-approved; tests-first per project G6).**

Date: 2026-05-17. Companion to `definition.md` / `design.md` / `plan.md` /
`execution.md` for the server-side draft-memo feature.

---

## 1. Reported symptoms

> "We have existing items saved as drafts and even after we push them for
> publish, they are saved in draft when they should be removed. Saving as a
> draft still makes them show up in the home page."

Decomposed:

- **S1 — Publish does not consume the draft.** After resuming a draft and
  pressing **Save** (publish), the draft row is still present in the Drafts
  list. It is never transitioned to `NORMAL` nor removed.
- **S2 — A published copy appears on Home.** The act of going draft → publish
  results in a memo on the Home feed *while the original draft also remains* —
  i.e. a duplicate, not a move.

---

## 2. Root cause — single defect, frontend only

Both symptoms are produced by **one** gap: **`handleSave` (the publish path) is
unaware of `resumedDraftName`.** It always takes `memoService.save`'s *create*
branch, minting a brand-new `NORMAL` memo and leaving the draft row untouched.

### 2.1 Verified-correct components (NOT the bug)

The entire backend draft lifecycle and the save-as-draft path are correct in the
working tree:

| Component | File:line | Verified behavior |
|---|---|---|
| State enum converter | `server/router/api/v1/common.go:33-42` | `State_DRAFT → store.Draft`; default → `store.Normal` (E1/E12) ✓ |
| `CreateMemo` honors state | `server/router/api/v1/memo_service.go:108` | `RowStatus: convertStateToStore(request.Memo.State)` ✓ |
| Driver C4 fix (SQLite) | `store/db/sqlite/memo.go:42-46` | conditionally emits `row_status` — DRAFT persists ✓ |
| Draft side-effect suppression | `memo_service.go:180-199` | no webhook/SSE/mention for a draft ✓ |
| `ListMemos` default excludes draft | `memo_service.go:230-233` | non-DRAFT/ARCHIVED requests pin `store.Normal` ✓ |
| `ListMemos` DRAFT branch | `memo_service.go:222-229` | creator-only, mirrors ARCHIVED ✓ |
| **Backend publish transition** | `memo_service.go:549-561` | `path=="state"` + `prev==Draft && new==Normal` → refresh `created_ts`/`updated_ts`; side-effects fire (`memo_update_helpers.go`) ✓ |
| Home feed requests NORMAL | `web/.../PagedMemoList.tsx:94`, `pages/Home.tsx:21` | `state: props.state \|\| State.NORMAL` ✓ |
| `saveDraft` create/update | `memoService.ts:133-182` | sends `state: State.DRAFT`; update branch masks `state` ✓ |

Conclusion: a pure **save-as-draft** correctly stores `row_status='DRAFT'` and
is correctly excluded from Home. The backend is **ready to publish** a draft via
`updateMemo({ memo:{name, state:NORMAL}, updateMask:{paths:[...,"state"]} })`.
**Nothing on the backend needs to change.**

### 2.2 The defective path — publish of a resumed draft

Trace, by file:line:

1. Drafts list item clicked → `handleResumeDraft` (`index.tsx:417-431`):
   `getMemo` → `memoService.fromMemo` → `dispatch(initMemo)` → and
   `setResumedDraftName(full.name)`. The editor is the **create-mode composer**
   (`memo` prop undefined ⇒ `memoName = memo?.name` is `undefined`,
   `index.tsx:124`).
2. User presses **Save** to publish → `handleSave` (`index.tsx:302-366`).
3. `handleSave` calls `memoService.save(state, { memoName, parentMemoName })`
   (`index.tsx:313`) with `memoName === undefined`.
4. In `memoService.save`, `options.memoName` is falsy, so it **skips** the
   update branch (`memoService.ts:91-104`) and runs the **create branch**
   (`memoService.ts:107-122`): `memoServiceClient.createMemo({ memo: memoData })`.
5. `memoData` (`memoService.ts:107-115`) has **no `state` field** ⇒ wire value
   `STATE_UNSPECIFIED` ⇒ backend `convertStateToStore` ⇒ `store.Normal`. **A new
   `NORMAL` memo is created.**
6. `resumedDraftName` is **never read by `handleSave`** — it is consumed only by
   `handleSaveDraft` (`index.tsx:375`). The original `row_status='DRAFT'` row is
   never updated and never deleted.

**Net effect:** new NORMAL memo → appears on Home (**S2**); original draft row
stays `DRAFT` → still in the Drafts list (**S1**). The intended contract flow
(`04-implementation-contract.md` §4.3 / §9 PUBLISH = `updateMemo` state
`DRAFT→NORMAL` on the *same row*) is never invoked from the UI.

### 2.3 Why the test suite missed it

`execution.md` T4 added `TestUpdateMemo_PublishDraftRefreshesTimestampsAndFiresSideEffects`
— it pins the **backend** transition, which works. T9's frontend tests cover
`saveDraft` / `useDrafts` / toolbar wiring, but **no test asserts that resuming a
draft and pressing Save publishes the *existing* draft instead of creating a new
memo.** That is the exact uncovered seam.

---

## 3. Fix — as built (tests-first per project G6)

**Scope: frontend only, 2 source files + 1 extended test file. Zero backend
change.**

### Phase 1 — Failing tests first (RED) — DONE

- ADDED a `memoService.publishDraft (bugfix: publish a resumed draft)` describe
  block to **`web/tests/memo-editor-cache.test.ts`** (mirrors the existing
  `saveDraft` block; reuses its module-level `@/connect` + `uploadService`
  mocks). Three pins:
  1. `publishDraft` builds the same `MemoSchema` field set as `saveDraft` but
     `state: State.NORMAL` (and stamps `name`).
  2. `publishDraft` **always** calls `updateMemo`, **never** `createMemo`, with
     `memo.name === draftMemoName`, `memo.state === State.NORMAL`, and
     `updateMask.paths` ⊇ `[content,visibility,attachments,relations,location,state]`
     — directly pins S1+S2.
  3. returns the published memo's name.
- **Deviation from the pre-approval plan:** the standalone
  `web/tests/publish-resumed-draft.test.tsx` full-`<MemoEditor>`-render test was
  **not** added. The project has no full-editor render harness; every editor
  test (T5/T9: `saveDraft`, `useDrafts`, toolbar) pins the contract at the
  `memoService`/hook boundary with a mocked `@/connect`. The defective call
  shape lives precisely at that boundary (`createMemo` vs `updateMemo`), so
  pinning `publishDraft` there is the robust, on-pattern regression guard; a
  full-render resume→save test would be brittle and off-convention.
- Verified RED: 3 fail (`publishDraft` not exported), 8 pre-existing
  `saveDraft`/cache tests stay green.

### Phase 2 — `memoService.publishDraft` + shared builder (GREEN) — DONE

- **File:** `web/src/components/MemoEditor/services/memoService.ts`
- Extracted the shared `create(MemoSchema, {...})` build (was duplicated in
  `save()`'s create branch and `saveDraft()`) into one private
  `buildMemoData(state, allAttachments, overrides?)`. `save`/`saveDraft`/
  `publishDraft` all consume it — the duplication the contract warned against is
  now removed, not tripled.
- Added `publishDraft(state, { draftMemoName })`: `uploadFiles` → `buildMemoData`
  with `{ state: State.NORMAL, name: draftMemoName }` → `updateMemo` with
  `updateMask.paths = [content,visibility,attachments,relations,location,state]`
  → `{ memoName }`. Exactly the call the backend transition at
  `memo_service.go:549-561` expects.

### Phase 3 — Route `handleSave` through publish — DONE

- **File:** `web/src/components/MemoEditor/index.tsx`
- In `handleSave`, **after** `validationService.canSave` passes (publish stays
  validated — unlike `saveDraft`):
  `isPublishingResumedDraft = Boolean(resumedDraftName) && !memoName &&
  !parentMemoName` → `memoService.publishDraft(state,{draftMemoName})` (wrapped
  to `{ memoName, hasChanges: true }`); else the unchanged `memoService.save`.
- Added `setResumedDraftName(undefined)` to `handleSave`'s success path (was
  only cleared by `handleSaveDraft`).
- Post-save `memoKeys.lists()` invalidation already covers both Home
  (`useInfiniteMemos`) and Drafts (`useDrafts`); flipping `DRAFT→NORMAL` makes
  the row *move* (leaves Drafts, enters Home) — no duplicate. `discardDraft()` +
  reset already run.

### Phase 4 — Gate sweep — DONE

- `cd web && pnpm test --run tests/memo-editor-cache.test.ts
  tests/editor-toolbar-save-draft.test.ts tests/use-drafts.test.ts` →
  **19/19 PASS**.
- `cd web && pnpm lint` (tsc --noEmit + Biome, 373 files) → **clean**.
- Full `pnpm test --run` → 101 pass; the only red is the **pre-existing,
  unrelated** `filtered-memo-stats.test.ts` date-boundary failure
  (`2026-04-30` vs `2026-05-01`) — documented in `execution.md` as out of
  scope / must-not-fix-forward, fails identically without this change.
- No Go change → `go build ./...` unaffected.

---

## 4. Blast radius (actual)

2 frontend source files (`memoService.ts`, `index.tsx`) + 1 extended test file
(`memo-editor-cache.test.ts`). No new test file, no proto/store/Go-handler/
migration/component change. The backend publish transition was already
implemented and tested (`execution.md` T7); this fix only makes the UI invoke
it for a resumed draft.

---

## 5. Post-review hardening — PR #5964 bot feedback (tests-first) — DONE

Automated reviewers (Codex, CodeRabbit) on PR #5964 surfaced three real
correctness/security gaps in the *original* feature backend (T7/T8 era, not the
publish-orphan fix) plus four quality items. Each verified against source before
acting; none were false positives. Fixed tests-first (G6).

**A — draft mention-notification lifecycle (Codex P1+P2).** RED tests
`TestUpdateMemo_DraftReSaveDoesNotNotifyMentions` and
`TestUpdateMemo_PublishDraftNotifiesMentions` (`memo_service_draft_test.go`).
`memo_service.go` `UpdateMemo`: `dispatchMemoMentionNotificationsBestEffort`
fired on any `contentUpdated`, ungated by draft status (only webhook/SSE were
gated in `dispatchMemoUpdatedSideEffects`). Fix: a `publishedFromDraft` flag set
on the `Draft→NORMAL` transition; mentions are skipped while the post-update row
is still `Draft`, and on publish dispatched with empty `previousContent` so the
now-visible content's mentions all notify exactly once.

**B — `ListAllUserStats` draft leak (Codex P2, security).** RED test
`TestListAllUserStats_DraftStatsAreCreatorOnly`. The endpoint is public
(`acl_config.go:27`); `convertStateToStore` now yields `store.Draft`, and only
`ARCHIVED` was creator-scoped, so an unauthenticated caller could enumerate
PUBLIC drafts' stats. Fix: `user_service_stats.go` creator-scopes `DRAFT`
exactly like `ARCHIVED` (unauth → empty).

**C — quality/contract.**
- MCP `list_memos`/`update_memo` `state` enum+description now include `DRAFT`
  (`tools_memo.go`), matching `parseRowStatus`.
- `migrator_draft_test.go` SQL parameterized (variadic `execMigrationSQL` +
  `db.Exec` placeholders) — clears the gosec/string-built-SQL gate.
- `handleResumeDraft` (`index.tsx`) routes through
  `queryClient.fetchQuery(memoKeys.detail)` instead of a direct connect-client
  call (repo's React-Query-data-layer guideline).
- Stale tests-first "RED today / PASSES today / must STAY green" narration
  rewritten to present-tense guard/regression-pin language across all
  `*_draft_test.go` headers.

**Gates.** `go build ./...` ✅; full Go draft sweep (store/api/mcp/frontend/
runner) ✅; frontend 19/19 ✅; `pnpm lint` ✅; `golangci-lint` on touched
packages clean — the lone remaining `connect_interceptors.go:84` govet is the
pre-existing, untouched, out-of-scope item already noted in `execution.md`
(not fixed-forward).

The "review required / workflows awaiting maintainer / cannot push to branch"
notes are upstream branch-protection for external contributors — not code
issues; resolved by a maintainer, not in this PR.
