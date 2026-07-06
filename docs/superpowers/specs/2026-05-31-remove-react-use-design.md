# Remove react-use Design

## Context

The frontend has a direct dependency on `react-use@17.6.0`. Current source usage is limited to six imports:

- `usePrevious` in `web/src/layouts/RootLayout.tsx`
- `useLocalStorage` in `web/src/components/MemoExplorer/TagsSection.tsx`
- `useWindowScroll` in `web/src/components/MobileHeader.tsx`
- `useToggle` in `web/src/components/TagTree.tsx`
- `useDebounce` in `web/src/components/MemoEditor/Toolbar/InsertMenu.tsx`
- `useDebounce` in `web/src/components/MemoEditor/hooks/useLinkMemo.ts`

`react-use` pulls in `js-cookie@2.2.1` transitively. A direct `js-cookie@3.0.7` dependency does not remove that vulnerable transitive copy, so the better remediation is to remove `react-use` rather than adding another copy of `js-cookie`.

## Goals

- Remove `react-use` from `web/package.json` and `web/pnpm-lock.yaml`.
- Remove all source imports from `react-use` and `react-use/lib/*`.
- Prefer built-in React hooks directly where the replacement is simple.
- Add local hooks only where reuse or browser-side-effect cleanup makes the code clearer and safer.
- Confirm `react-use` and `js-cookie` are no longer present in the frontend dependency graph.

## Non-Goals

- Do not introduce another general-purpose React hooks library.
- Do not refactor unrelated frontend state management.
- Do not change user-visible behavior of tag preferences, tag tree expansion, scroll shadow behavior, route filter clearing, memo link search, or reverse geocoding debounce.

## Approach

Use native React hooks for one-off, simple behavior:

- Replace `useToggle` in `TagTree` with `useState(false)` plus local callbacks.
- Replace `usePrevious` in `RootLayout` with local `useRef` and `useEffect` while preserving the existing previous-path comparison.
- Replace `useWindowScroll` in `MobileHeader` with local `useState` and `useEffect` for the scroll listener.

Create focused local hooks where repeated behavior or cleanup consistency matters:

- Add `useDebouncedEffect` under `web/src/hooks/` for the two debounce call sites. It schedules a callback after the configured delay and clears the timeout when dependencies change or the component unmounts.
- Add a typed `useLocalStorage` under `web/src/hooks/` for tag display settings. It reads the stored value on initialization, falls back to the provided default, writes updates to `localStorage`, and tolerates unavailable or malformed storage by using the default.

Update imports to use `@/hooks/...` for local hooks. Keep hook APIs small and shaped around current usage rather than cloning the full `react-use` API.

## Data Flow And Behavior

Tag view settings continue to persist in `localStorage` under the same keys:

- `tag-view-as-tree`
- `tag-tree-auto-expand`

Debounced effects continue to defer:

- reverse-geocoding position updates in the memo editor insert menu by 1000 ms
- memo link search requests by 300 ms

The route filter clearing logic continues to run only when navigation changes route and the URL has no `filter` parameter.

The mobile header continues to show its shadow when the window has scrolled below the top.

## Error Handling

The local storage hook catches read and write failures. On read failure or malformed JSON, it returns the default value. On write failure, it keeps React state updated so the current UI interaction still works, while avoiding a thrown render or event-handler error.

Debounced effects do not swallow errors inside the user callback. Existing call sites already handle their own asynchronous errors where needed.

## Testing And Verification

Run frontend validation after implementation:

- `pnpm install --lockfile-only` from `web/` to regenerate `pnpm-lock.yaml`
- `pnpm why react-use js-cookie` from `web/` and confirm neither dependency remains
- `pnpm lint` from `web/`
- `pnpm build` from `web/`

Manual checks should cover:

- toggling tag tree mode and auto-expand persists across reload
- opening tag tree nodes still works
- mobile header shadow appears after scrolling
- memo link search still debounces and updates results
- location reverse geocoding still waits for position changes before lookup
