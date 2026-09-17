# Habits Momentum Implementation Plan

> **For Codex:** Execute this plan in order, keeping each checkpoint independently testable.

**Goal:** Ship an authenticated, durable daily habit tracker with measurable check-ins, streak/performance analytics, XP/levels, and Atomic Habits cues.

**Architecture:** Add `habit` and `habit_log` records to the store and all three database drivers, expose them through a private Connect/gRPC-Gateway service, then build a React Query-backed `/habits` dashboard. Keep reward and streak math pure and computed from logs so it is deterministic and never drifts from stored counters.

**Tech Stack:** Go, SQL (SQLite/MySQL/PostgreSQL), Protocol Buffers, Connect RPC, React 19, TypeScript, React Query, Tailwind CSS v4, Vitest.

---

### Task 1: Pure habit progress rules

**Files:**
- Create: `core/habit/progress.go`
- Test: `core/habit/progress_test.go`

- [ ] Write failing table tests for streak, best streak, consistency, target completion, XP, level, open today, and recovery.
- [ ] Implement the smallest pure calculator that passes them.
- [ ] Run `go test -v ./core/habit`.

### Task 2: Persistence schema and models

**Files:**
- Create: `store/habit.go`
- Modify: `store/driver.go`
- Create: `store/migration/{sqlite,mysql,postgres}/0.31/08__habit.sql`
- Modify: `store/migration/{sqlite,mysql,postgres}/LATEST.sql`
- Create: `store/db/{sqlite,mysql,postgres}/habit.go`
- Test: `store/db/sqlite/habit_test.go`

- [ ] Write a failing SQLite driver test for create/list/get ownership and idempotent daily upsert.
- [ ] Add models and driver contract.
- [ ] Add equivalent schemas and implementations for all drivers.
- [ ] Run targeted SQLite/store tests.

### Task 3: Habit API contract and service

**Files:**
- Create: `proto/api/v1/habit_service.proto`
- Generated: `proto/gen/api/v1/*habit*`, `web/src/types/proto/api/v1/*habit*`, OpenAPI outputs
- Create: `server/api/v1/habit_service.go`
- Modify: `server/api/v1/v1.go`
- Modify: `server/api/v1/connect_handler.go`
- Modify: `web/src/connect.ts`
- Test: `server/api/v1/habit_service_test.go`

- [ ] Write failing service tests for validation, owner isolation, upsert replacement, and summary rules.
- [ ] Define and generate the API.
- [ ] Implement validation, ownership checks, conversion, and summary calculation.
- [ ] Register Connect and gateway handlers; keep endpoints private.
- [ ] Run `buf lint` and targeted server tests.

### Task 4: React Query data layer

**Files:**
- Create: `web/src/hooks/useHabits.ts`
- Test: `web/src/hooks/useHabits.test.tsx`

- [ ] Write failing tests for query keys and mutation invalidation.
- [ ] Implement list, summary, create, update, delete, upsert-log, and delete-log hooks.
- [ ] Run the focused Vitest file.

### Task 5: Momentum dashboard

**Files:**
- Create: `web/src/pages/Habits.tsx`
- Create: `web/src/components/Habits/HabitFormDialog.tsx`
- Create: `web/src/components/Habits/HabitMomentumChart.tsx`
- Create: `web/src/components/Habits/HabitMomentumDashboard.tsx`
- Test: `web/src/components/Habits/HabitMomentumDashboard.test.tsx`
- Modify: `web/src/router/routes.ts`
- Modify: `web/src/router/index.tsx`
- Modify: `web/src/components/AppSidebar/AppSidebar.tsx`

- [ ] Write failing component tests for empty state, minimum-vs-target messaging, save/undo, and recovery state.
- [ ] Implement responsive dashboard, chart, chain, XP level, and Atomic Habits cue card.
- [ ] Add protected route and navigation entry.
- [ ] Verify keyboard labels, small-screen layout, and reduced-motion behavior.

### Task 6: Full verification and handoff

- [ ] Run `go test -v ./core/habit ./server/api/v1` and the available store tests.
- [ ] Run `cd proto && buf lint`.
- [ ] Run `cd web && pnpm lint && pnpm test && pnpm build`.
- [ ] Run `git diff --check` and inspect the branch diff.
- [ ] Document any environment-only failures separately from feature failures.
