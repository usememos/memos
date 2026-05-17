## Background & Context

memos has no server-side draft. "Draft" today is a frontend-only, ephemeral convenience: while *creating* a new memo, unsaved editor content is debounced (500ms) into `localStorage` via `cacheService` (`web/src/components/MemoEditor/services/cacheService.ts`), keyed per user as `${username}-${cacheKey}`, and only when `isDraftCacheEnabled = !memo` is true (`web/src/components/MemoEditor/index.tsx:78`). It is a single slot per editor, not synced, not listable, has no server representation, and is lost if the browser storage is cleared or the user switches devices.

The transport and storage layers already carry a draft-shaped slot. `Memo.state` (`proto/api/v1/memo_service.proto:201`) references `enum State` (`proto/api/v1/common.proto:7`), which today has only `NORMAL` and `ARCHIVED`. The store mirrors this as `RowStatus` (`store/common.go`) persisted in the `memo.row_status` column. `ListMemos` already filters by state (`server/router/api/v1/memo_service.go:181`) and `store.FindMemo` already filters at the store layer (`store/memo.go:65`). A draft is therefore most naturally a third lifecycle state — not a new table, column, proto message, or RPC.

This definition is the reformatting of the `aurum-systems/` architecture audit (docs 01–04) into the repo's `docs/plans/` format. Doc `aurum-systems/04-implementation-contract.md` is the authoritative source and supersedes docs 02/03 where they conflict; it records a 4-way parallel verification of the working tree (audit date 2026-05-17, same day as this plan; line numbers verified then) and corrects three factual errors plus one previously-unflagged silent-failure gap (see Current State, C1–C4).

## Issue Statement

Memo drafts in memos are frontend-only and ephemeral: `CreateMemo` (`server/router/api/v1/memo_service.go:73`) builds a `store.Memo` from UID/CreatorID/Content/Visibility only and never reads `request.Memo.State`, the per-driver `CreateMemo` INSERT omits `row_status` entirely (relying on the DB `DEFAULT 'NORMAL'`), and `State`/`RowStatus` has no `DRAFT` value; as a result there is no durable, cross-device, listable server-side draft that inherits the existing memo functionality (content, visibility, attachments, relations, location, timestamps), and adding one requires an explicit lifecycle-state design plus an exhaustive audit of every reader that currently assumes a default `NORMAL` filter.

## Current State

**Frontend "draft" (ephemeral, localStorage)** — `web/src/components/MemoEditor/`
- `cacheService.{save,saveNow,load,clear,clearAll}` (`services/cacheService.ts`, `CACHE_DEBOUNCE_DELAY = 500`) wraps `localStorage` directly with a JSON envelope.
- `useAutoSave` (`hooks/useAutoSave.ts`) writes on content change, flushes on page-hide/unmount, exposes `discardDraft()` (wired at `index.tsx:257`).
- Gated to new-memo composition only: `isDraftCacheEnabled = !memo` (`index.tsx:78`).
- `EditorState` (`state/types.ts:10–39`) has **no** draft/state field today.

**Transport (proto)** — `proto/api/v1/`
- `enum State { STATE_UNSPECIFIED=0; NORMAL=1; ARCHIVED=2; }` (`common.proto:7–11`). No `DRAFT`.
- `Memo.state` field 2 (`memo_service.proto:201`) and `ListMemosRequest.state` (`memo_service.proto:302`) already exist.

**Backend handler** — `server/router/api/v1/memo_service.go`
- `CreateMemo` (`:73`) builds `store.Memo` from UID/CreatorID/Content/Visibility only (`:87–92`).
- `ListMemos` (`:181`) state branch (`:191–202`): `if request.State == ARCHIVED { store.Archived + creator-only guard } else { store.Normal }` — default is **explicitly NORMAL**.
- `UpdateMemo` (`:452`) state path (`:518–520`) flips `row_status` generically via the field mask.
- Converters: `convertStateToStore` / `convertStateFromStore` (`server/router/api/v1/common.go:20–38`); MCP parallel `rowStatusToProto` (`server/router/mcp/api_helpers.go:24–29`).

**Store / driver** — `store/`
- `store.Memo`/`FindMemo`/`UpdateMemo` (`store/memo.go:35–103`) already carry `RowStatus` (lines 42, 65, 98) — no struct change needed.
- `store/common.go` has `RowStatus` consts `Normal`/`Archived` only.
- `row_status` is CHECK-constrained in **SQLite only** (`store/migration/sqlite/LATEST.sql:39`). MySQL is unconstrained `VARCHAR(256)` (`mysql/LATEST.sql:38`); Postgres is unconstrained `TEXT` (`postgres/LATEST.sql:38`).

**Corrections from the audit (these change scope — read before planning)**
- **C1** — `CreateMemoRequest` (`memo_service.proto:280–287`) is `{ memo, memo_id }` only; it has **no** top-level `state` field. State arrives via the nested `request.Memo.State`. (Docs 02/03 wrongly cited `CreateMemoRequest.state` at `proto:302`; that line is `ListMemosRequest.state`.) Net: no new proto field, but for a different reason than 02/03 stated.
- **C2** — `CreateMemo` does **not** honor `request.Memo.State` today; it never reads it. New handler logic is required, not a trivial "honor the existing path".
- **C3** — Relaxing the `row_status` CHECK is **SQLite-only**. MySQL/Postgres have no CHECK; adding no-op migrations there would be dead churn.
- **C4** (not in docs 02/03) — Driver `CreateMemo` in all three drivers (`store/db/{sqlite,mysql,postgres}/memo.go:16`) omits `row_status` from the INSERT, relying on `DEFAULT 'NORMAL'`. A `store.Memo{RowStatus:"DRAFT"}` is **silently discarded** and the row is created `NORMAL`. This is the single highest-risk silent failure: without the fix a "draft" is instantly a public memo.

**Leakage surface (every reader that must exclude `DRAFT`)** — verified safe-by-NORMAL-filter today and so must stay explicit: RSS (`server/router/.../rss.go:89,140`), sitemap (`server/router/frontend/frontend.go:150–152`), MCP list/search/access (`server/router/mcp/...`), user stats (`user_service_stats.go:208`), memo relations (`memo_relation_service.go:108–112`), payload runner (`server/runner/memopayload/runner.go:35`), reaction SSE (`reaction_service.go`), read-access guard (`memo_service.go:42–71`).

## Non-Goals

- A new table, struct, proto message, RPC, React component, hook pattern, or test harness — a draft is a `memo` row with `row_status='DRAFT'` and nothing else (rejects design Options B and C and the payload-JSON alternative D; see `design.md`).
- "Draft an edit to an already-published memo" — v1 is **new-memo drafts only**, matching today's `isDraftCacheEnabled = !memo` gate (`index.tsx:78`). (Edge E13.)
- Comments on drafts (`CreateMemoComment`, `memo_service.go:646`) — memos only in v1. (Edge E11 / Open Decision O2.)
- `Draft → ARCHIVED` direct transition — archiving an unpublished memo is meaningless in v1. (Edge E6 / Open Decision O2.)
- Any draft endpoint becoming public — drafts are creator-only; **no `acl_config.go` entry**.
- No-op MySQL/Postgres migrations — they have no CHECK to relax (C3).
- Changing the `Visibility` enum or collapsing visibility into lifecycle state — they remain independent columns; `(DRAFT, PUBLIC)` is expressible and still creator-only.
- Replacing `cacheService`/`localStorage` — it stays as the keystroke-level buffer; the server draft is the durable layer (Open Decision O1).

## Open Questions

Carried verbatim from `aurum-systems/04-implementation-contract.md` §10 (recommendations are the proposed defaults; flagged here so they are resolved before the dependent task runs):

1. **O1 — localStorage coexistence.** *Resolved (user direction 2026-05-17): explicit "Save draft" button + debounce; `cacheService` stays the keystroke-level buffer and is cleared on a successful server draft.* Rejected: every-autosave → server (causes write-storms, edge E8). Fully determines T9's save path — no implementation ambiguity remains.
2. **O2 — comments on drafts / `Draft → ARCHIVED`.** *Default: disallow both in v1* (edges E6, E11). Affects API boundary tasks.
3. **O3 — resume scope.** *Resolved (user direction 2026-05-17): fetch-into-fresh-editor for v1.* `EditorState` (`state/types.ts:10–39`) is **not** modified; no `editingDraftName?` field is added. Resume is `getMemo(name)` → load into a fresh editor reducer. Smaller surface; the conditional `state/types.ts` edit in T9 drops out entirely.
4. **O4 — publish timestamp behavior.** *Resolved by the audit per user direction:* publishing (`DRAFT → NORMAL`) refreshes both `created_ts` and `updated_ts`; a plain edit of an already-`NORMAL` memo must not (edge E5). The guard is the *transition*, not "state in mask". This is no longer open but is pinned by two tests so the resolution cannot silently regress.

Additional edge-case decisions to confirm during planning: E1 (`STATE_UNSPECIFIED` must still resolve to `NORMAL`), E4 (`saveDraft` must bypass the empty-content validation gate that blocks a normal save), E9 (SQLite-only `0.29` migration dir with no parallel mysql/pg `0.29` must be tolerated by `store/migrator.go:299–319`).

## Scope

**L** — the work spans one proto enum value plus three mirrors, a SQLite-only migration (with fresh-install + upgrade verification), a driver-layer correctness fix across all three drivers (C4), API-handler logic across `CreateMemo`/`ListMemos`/`UpdateMemo` plus side-effect suppression, an exhaustive leakage-exclusion audit of ~9 reader surfaces, two new frontend functions plus editor/toolbar wiring, and a tests-first suite (store/migration/API/frontend) authored before the implementing phases. Blast radius per the audit: ~2 ADD frontend fns, ~16 MODIFY sites, 1 ADD migration, 1 enum value (+3 mirrors), 0 new structs/RPCs/components/test infra.
