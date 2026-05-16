# First Screen Lazy Heavy Dependencies Design

## Context

The auth and signup pages currently fetch JavaScript and CSS assets for features that are not used on the first screen, including Mermaid, KaTeX, Leaflet, and React Leaflet. The current routing already uses lazy route components, so the remaining problem is eager imports from shared app entry points and feature modules.

The goal is to reduce first screen load time, especially for `/auth` and `/auth/signup`, without changing memo rendering, map behavior, or authenticated workflows.

## Goals

- Prevent Mermaid and Leaflet vendor chunks from loading on auth/signup before they are needed.
- Prevent Leaflet and KaTeX CSS from loading globally at app startup.
- Preserve current behavior when users view Mermaid diagrams, math content, memo location previews, profile maps, or location pickers.
- Keep fallbacks small and consistent with existing async rendering patterns.
- Verify the production build and confirm auth/signup network requests no longer include Mermaid or Leaflet chunks during initial render.

## Non-Goals

- Rewriting the markdown rendering pipeline.
- Removing support for Mermaid, KaTeX, Leaflet, or React Leaflet.
- Optimizing every authenticated route in this change.
- Changing server behavior, route guards, or authentication flow.

## Recommended Approach

Use feature-level lazy loading for heavy optional features. Keep the app shell and auth routes free of diagram, math styling, and map dependencies. Load those dependencies from the feature boundary where the user actually needs them.

This approach has the best balance of impact and risk because it removes known eager imports while preserving existing route structure and feature internals.

## Architecture

### App Entry

`web/src/main.tsx` should no longer import:

- `leaflet/dist/leaflet.css`
- `katex/dist/katex.min.css`

These styles are feature-specific and should be loaded from the map and markdown rendering paths.

### Mermaid

`web/src/components/MemoContent/MermaidBlock.tsx` should replace the static `import mermaid from "mermaid"` with an async `import("mermaid")` inside the render effect.

The component should keep its current behavior:

- initialize Mermaid with the resolved app theme;
- render when code content or theme changes;
- show the existing error fallback when rendering fails.

The Mermaid chunk should only be requested when a memo actually renders a Mermaid code block.

### KaTeX

KaTeX CSS should load from the memo markdown rendering path instead of the app entry. Since `rehype-katex` is only useful when memo markdown is rendered, loading the stylesheet near `MemoMarkdownRenderer` keeps auth/signup free of KaTeX CSS while preserving math output styling.

This change does not need content-level math detection. Loading KaTeX CSS with memo markdown is simpler and still removes it from the first auth/signup screen.

### Leaflet Maps

Leaflet-dependent UI should be moved behind lazy component boundaries:

- `UserMemoMap` should be lazy-loaded by the user profile route or by a small wrapper component.
- `LocationPicker` should be lazy-loaded where location UI is opened or displayed.

The underlying map implementations can continue using Leaflet, React Leaflet, marker clustering, and their current helpers. The key boundary is that parent components must not statically import the map implementation if that parent can be pulled into non-map first-screen chunks.

Leaflet CSS and marker cluster CSS should load inside the lazy map implementation path, not from `main.tsx`.

### Type Imports

Any imports from `leaflet` that are used only as TypeScript types should use `import type`. Runtime construction such as `new LatLng(...)` should be avoided in parent components that are meant to stay Leaflet-free; pass plain latitude/longitude data into lazy map wrappers and construct Leaflet objects inside the lazy implementation.

## Data Flow

Auth/signup initial render:

1. App entry initializes theme, locale, providers, auth, and instance data.
2. Router loads only the auth/signup route component and shared app shell dependencies.
3. Mermaid, Leaflet, React Leaflet, marker cluster, and feature CSS are not requested.

Memo markdown render:

1. Memo content renders with the existing markdown renderer.
2. KaTeX CSS loads with the markdown rendering path.
3. If a code block language is `mermaid`, `MermaidBlock` dynamically imports Mermaid and renders the diagram.

Map render:

1. A map feature mounts through a lazy boundary.
2. The lazy implementation imports Leaflet, React Leaflet, and required map CSS.
3. Existing map interactions and display behavior continue inside the loaded implementation.

## Error Handling

- Mermaid import or render failures should use the existing Mermaid error UI with the original code content visible.
- Lazy map boundaries should use minimal fallbacks sized like the eventual map container to avoid layout shift.
- Chunk load failures should continue to use the existing router chunk reload behavior where applicable.

## Testing

- Run `pnpm build` in `web`.
- Run `pnpm lint` in `web`.
- Inspect production build output to ensure Mermaid and Leaflet remain split chunks.
- Use a production preview or equivalent browser check for `/auth/signup` and confirm initial network requests do not include Mermaid or Leaflet JavaScript chunks.
- Smoke test memo content with Mermaid and math.
- Smoke test location picker, location popover, and user profile map.

## Risks

- Loading CSS from lazy paths can cause a small style delay the first time a map or math content appears. Use map-sized fallbacks and keep CSS imports in the feature implementation to minimize visible shifts.
- Moving Leaflet runtime types out of parent components may require small prop shape changes.
- Dynamic Mermaid import needs effect cancellation to avoid setting state after unmount.
