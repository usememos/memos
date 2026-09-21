---
title: "Developing the memo editor"
status: draft
tags:
  - "editor"
---

Reader: a frontend contributor who embeds the memo editor in a page or tests its save logic. Task: render `MemoEditor` in create or edit mode, and unit-test its services. Step actor: the contributor.

## Prerequisites
- A working `web/` setup with dependencies installed (`pnpm`, per `packageManager` in `@web/package.json`).
- The component and its props: default export of `@web/src/components/MemoEditor/index.tsx`; `MemoEditorProps` in `@web/src/components/MemoEditor/types/components.ts`.
- Unit tests live under `web/tests/` and run with Vitest in jsdom (`@web/vitest.config.mts`).

## Steps
1. Import the editor:
   ```typescript
   import MemoEditor from "@/components/MemoEditor";
   ```
2. For create mode, render it without `memo`, with a `cacheKey` and the callbacks you need:
   ```typescript
   <MemoEditor
     cacheKey="home-composer"
     onConfirm={(name) => console.log("Saved:", name)}
     onCancel={() => console.log("Cancelled")}
   />
   ```
3. For edit mode, pass the existing `Memo` as the `memo` prop instead.
4. To test save logic without React, build a state with `createInitialState()` from `@web/src/components/MemoEditor/state/types.ts`.
5. Call the service with that state:
   ```typescript
   const state = createInitialState();
   const result = await memoService.save(state, { memoName: "memos/123" });
   ```
6. Run the web tests from `web/`:
   ```bash
   pnpm test
   ```

## Verification
- In create mode, saving calls `onConfirm` with the new memo name; cancelling calls `onCancel`.
- `pnpm test` (`vitest run`) reports the test file as passed.

## Common Issues
- An edit-mode editor starts empty or refetches. Pass the full `Memo` object as `memo`; the editor then initializes from it without fetching.
