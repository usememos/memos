---
title: "Confirmation dialog contract"
status: draft
tags:
  - "ui"
---

## Purpose & Scope
This spec defines `ConfirmDialog` in `@web/src/components/ConfirmDialog/index.tsx`, the shared confirmation dialog for sync and async actions. It is normative for that component; every screen that asks the user to confirm an action depends on it. Out of scope: the underlying `Dialog` and `Button` primitives in `@web/src/components/ui/`.

## Surface
- Props: `ConfirmDialogProps` in `@web/src/components/ConfirmDialog/index.tsx`:
  - `open: boolean` (required) — `true` visible, `false` hidden.
  - `onOpenChange: (open: boolean) => void` (required) — receives the next open state.
  - `title: React.ReactNode` (required) — short localized action summary.
  - `description?: React.ReactNode` — optional context message.
  - `confirmLabel: string`, `cancelLabel: string` (required).
  - `onConfirm: () => void | Promise<void>` (required) — sync or async handler.
  - `confirmVariant?: "default" | "destructive"` — defaults to `"default"`.
- Structure: internal `loading` state (pending confirm); a dialog header with title and description; a footer with cancel and confirm buttons.
- Control: the parent owns the open state through `onOpenChange`.

## Normative Behavior
1. The dialog MUST track a pending confirm action in its `loading` state.
2. The dialog MUST render `title` in the header, and `description` below it only when provided.
3. WHEN the user activates the confirm button, the dialog MUST await `onConfirm`, whether it is sync or async.
4. WHEN `onConfirm` resolves, the dialog MUST call `onOpenChange(false)`.
5. WHEN the user activates the cancel button, the dialog MUST call `onOpenChange(false)`.
6. The dialog MUST render the confirm button with the `confirmVariant` button variant.
7. The caller SHOULD update its own open state from the `onOpenChange` callback.
8. The caller MUST pass a non-empty localized `confirmLabel`.
9. The caller SHOULD keep `confirmLabel` to one or two words.
10. WHEN the action is irreversible, the caller MUST pass `confirmVariant="destructive"`.
11. The caller MUST take every visible string from the translation system through `useTranslate()` (`@web/src/utils/i18n.ts`).
12. The caller MUST use separate translation keys for `title` and `description`.

## Constraints & Invariants
- Invariant: the parent, not the dialog, owns the open state.
- Invariant: the dialog requests closing only after `onConfirm` resolves or on cancel.
- Constraint: the dialog provides no text of its own; all labels come from the caller.

## Failure Behavior
1. IF `onConfirm` throws or rejects, THEN the dialog MUST catch the error and log it with `console.error`.
2. IF `onConfirm` throws or rejects, THEN the dialog MUST stay open so the caller can show a toast or inline message and allow retry.
3. IF `onConfirm` fails with a serious error, THEN the caller MAY route it to a higher-level handler.

## Conformance
An implementation conforms when it meets behaviors 1–12, holds the invariants, and follows the failure rules.
Given an open dialog whose `onConfirm` rejects,
When the user activates the confirm button,
Then the dialog stays open for a retry.
