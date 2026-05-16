# First Screen Lazy Heavy Dependencies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Mermaid, Leaflet, React Leaflet, marker cluster, and feature CSS out of the auth/signup initial screen while preserving diagram, math, and map behavior when those features are used.

**Architecture:** Move runtime Leaflet objects behind plain coordinate data at parent boundaries, then lazy-load map implementations from small wrapper components. Replace Mermaid's static import with effect-time dynamic import, and move KaTeX/Leaflet CSS from the app entry into feature modules.

**Tech Stack:** React 19, TypeScript 6, Vite 8/Rolldown, React Router 7, React Query 5, Mermaid, KaTeX, Leaflet, React Leaflet, pnpm.

---

## File Structure

- Create `web/src/components/map/types.ts`
  - Defines a lightweight `MapPoint` interface used by parents that must not import Leaflet.
- Create `web/src/components/map/LazyLocationPicker.tsx`
  - Provides a `React.lazy` boundary and map-sized fallback for `LocationPicker`.
- Modify `web/src/main.tsx`
  - Removes global Leaflet and KaTeX CSS imports.
- Modify `web/src/router/index.tsx`
  - Lazy-loads the Home route so memo/editor/markdown modules are not part of the auth/signup entry graph.
- Modify `web/vite.config.mts`
  - Keeps optional heavy dependency split groups from becoming entry preloads.
- Modify `web/src/components/map/LocationPicker.tsx`
  - Imports Leaflet CSS inside the lazy implementation path.
  - Accepts and emits plain `MapPoint` values at the public component boundary.
  - Keeps `LatLng` runtime use internal to the map implementation.
- Modify `web/src/components/map/index.ts`
  - Stops exporting `LocationPicker` and map utility helpers from the barrel so non-map imports do not pull Leaflet into parent chunks.
  - Keeps exporting `useReverseGeocoding` because it has no Leaflet dependency.
- Modify `web/src/components/MemoEditor/types/insert-menu.ts`
  - Replaces `LatLng` in editor state with `MapPoint`.
- Modify `web/src/components/MemoEditor/hooks/useLocation.ts`
  - Removes runtime Leaflet import and stores plain coordinates.
- Modify `web/src/components/MemoEditor/Toolbar/InsertMenu.tsx`
  - Removes runtime Leaflet import.
  - Imports `useReverseGeocoding` directly from its file.
  - Constructs plain coordinates from geolocation.
- Modify `web/src/components/MemoMetadata/Location/LocationDialog.tsx`
  - Uses `LazyLocationPicker` and `MapPoint`.
  - Only mounts the lazy picker while the dialog is open.
- Modify `web/src/components/MemoMetadata/Location/LocationDisplayView.tsx`
  - Removes runtime Leaflet import and uses `LazyLocationPicker` inside the popover.
- Modify `web/src/pages/UserProfile.tsx`
  - Lazy-loads `UserMemoMap` only when the map tab is active.
- Modify `web/src/components/MemoContent/MemoMarkdownRenderer.tsx`
  - Imports KaTeX CSS from the markdown-rendering path.
- Modify `web/src/components/MemoContent/MermaidBlock.tsx`
  - Dynamically imports Mermaid only when rendering a Mermaid block.
- Modify `web/src/components/UserMemoMap/UserMemoMap.tsx`
  - Keeps marker cluster CSS in the lazy map implementation path.
- Verify with `pnpm lint`, `pnpm build`, and a production preview/browser network check.

## Task 1: Remove Leaflet From Editor Location State

**Files:**
- Create: `web/src/components/map/types.ts`
- Modify: `web/src/components/MemoEditor/types/insert-menu.ts`
- Modify: `web/src/components/MemoEditor/hooks/useLocation.ts`
- Modify: `web/src/components/MemoEditor/Toolbar/InsertMenu.tsx`

- [x] **Step 1: Add a Leaflet-free map coordinate type**

Create `web/src/components/map/types.ts`:

```ts
export interface MapPoint {
  lat: number;
  lng: number;
}
```

- [x] **Step 2: Replace editor location state type**

In `web/src/components/MemoEditor/types/insert-menu.ts`, replace the entire file with:

```ts
import type { MapPoint } from "@/components/map/types";

export interface LocationState {
  placeholder: string;
  position?: MapPoint;
  latInput: string;
  lngInput: string;
}
```

- [x] **Step 3: Remove Leaflet runtime usage from `useLocation`**

In `web/src/components/MemoEditor/hooks/useLocation.ts`, remove `import { LatLng } from "leaflet";`, add a type import, and use plain coordinate objects:

```ts
import { create } from "@bufbuild/protobuf";
import { useCallback, useMemo, useRef, useState } from "react";
import type { MapPoint } from "@/components/map/types";
import { Location, LocationSchema } from "@/types/proto/api/v1/memo_service_pb";
import { LocationState } from "../types/insert-menu";

export const useLocation = (initialLocation?: Location) => {
  const [locationInitialized, setLocationInitialized] = useState(false);
  const locationInitializedRef = useRef(locationInitialized);
  locationInitializedRef.current = locationInitialized;

  const [state, setState] = useState<LocationState>({
    placeholder: initialLocation?.placeholder || "",
    position: initialLocation ? { lat: initialLocation.latitude, lng: initialLocation.longitude } : undefined,
    latInput: initialLocation ? String(initialLocation.latitude) : "",
    lngInput: initialLocation ? String(initialLocation.longitude) : "",
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const updatePosition = useCallback((position?: MapPoint) => {
    setState((prev) => ({
      ...prev,
      position,
      latInput: position ? String(position.lat) : "",
      lngInput: position ? String(position.lng) : "",
    }));
  }, []);

  const handlePositionChange = useCallback(
    (position: MapPoint) => {
      if (!locationInitializedRef.current) setLocationInitialized(true);
      updatePosition(position);
    },
    [updatePosition],
  );

  const updateCoordinate = useCallback((type: "lat" | "lng", value: string) => {
    const num = parseFloat(value);
    const isValid = type === "lat" ? !isNaN(num) && num >= -90 && num <= 90 : !isNaN(num) && num >= -180 && num <= 180;
    setState((prev) => {
      const next = { ...prev, [type === "lat" ? "latInput" : "lngInput"]: value };
      if (isValid && prev.position) {
        const newPos = type === "lat" ? { lat: num, lng: prev.position.lng } : { lat: prev.position.lat, lng: num };
        return { ...next, position: newPos, latInput: String(newPos.lat), lngInput: String(newPos.lng) };
      }
      return next;
    });
  }, []);

  const setPlaceholder = useCallback((placeholder: string) => {
    setState((prev) => ({ ...prev, placeholder }));
  }, []);

  const reset = useCallback(() => {
    setState({
      placeholder: "",
      position: undefined,
      latInput: "",
      lngInput: "",
    });
    setLocationInitialized(false);
  }, []);

  const getLocation = useCallback((): Location | undefined => {
    const { position, placeholder } = stateRef.current;
    if (!position || !placeholder.trim()) {
      return undefined;
    }
    return create(LocationSchema, {
      latitude: position.lat,
      longitude: position.lng,
      placeholder,
    });
  }, []);

  return useMemo(
    () => ({ state, locationInitialized, handlePositionChange, updateCoordinate, setPlaceholder, reset, getLocation }),
    [state, locationInitialized, handlePositionChange, updateCoordinate, setPlaceholder, reset, getLocation],
  );
};
```

- [x] **Step 4: Remove Leaflet import from `InsertMenu`**

In `web/src/components/MemoEditor/Toolbar/InsertMenu.tsx`:

Remove:

```ts
import { LatLng } from "leaflet";
```

Replace:

```ts
import { useReverseGeocoding } from "@/components/map";
```

with:

```ts
import { useReverseGeocoding } from "@/components/map/useReverseGeocoding";
```

Replace the geolocation success handler body:

```ts
handleLocationPositionChange(new LatLng(position.coords.latitude, position.coords.longitude));
```

with:

```ts
handleLocationPositionChange({ lat: position.coords.latitude, lng: position.coords.longitude });
```

- [x] **Step 5: Run focused type check**

Run:

```bash
cd web && pnpm lint
```

Expected: TypeScript may still fail because map component props have not been converted yet. If the only failures are `LatLng`/`MapPoint` mismatches in map/location components, continue to Task 2. If unrelated failures appear, stop and inspect before editing further.

## Task 2: Lazy-Load Location Picker And Keep Leaflet Inside Map Modules

**Files:**
- Create: `web/src/components/map/LazyLocationPicker.tsx`
- Modify: `web/src/components/map/LocationPicker.tsx`
- Modify: `web/src/components/map/index.ts`
- Modify: `web/src/components/MemoMetadata/Location/LocationDialog.tsx`
- Modify: `web/src/components/MemoMetadata/Location/LocationDisplayView.tsx`

- [x] **Step 1: Create lazy location picker wrapper**

Create `web/src/components/map/LazyLocationPicker.tsx`:

```tsx
import { lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import type { MapPoint } from "./types";

interface LazyLocationPickerProps {
  readonly?: boolean;
  latlng?: MapPoint;
  onChange?: (position: MapPoint) => void;
  className?: string;
}

const LocationPicker = lazy(() => import("./LocationPicker"));

export const LazyLocationPicker = ({ className, ...props }: LazyLocationPickerProps) => {
  return (
    <Suspense
      fallback={
        <div
          className={cn(
            "memo-location-map relative isolate h-72 w-full overflow-hidden rounded-xl border border-border bg-muted/30 shadow-sm",
            className,
          )}
        />
      }
    >
      <LocationPicker className={className} {...props} />
    </Suspense>
  );
};
```

- [x] **Step 2: Convert `LocationPicker` public props to `MapPoint`**

In `web/src/components/map/LocationPicker.tsx`:

Add CSS and type imports near the top:

```ts
import "leaflet/dist/leaflet.css";
import type { MapPoint } from "./types";
```

Keep Leaflet runtime import:

```ts
import L, { LatLng } from "leaflet";
```

Add helper functions after imports:

```ts
const toLatLng = (point: MapPoint): LatLng => new LatLng(point.lat, point.lng);
const fromLatLng = (latlng: LatLng): MapPoint => ({ lat: latlng.lat, lng: latlng.lng });
```

Update public-facing props:

```ts
interface LocationMarkerProps {
  position: LatLng | undefined;
  onChange: (position: MapPoint) => void;
  readonly?: boolean;
}
```

In `LocationMarker`, replace:

```ts
onChange(e.latlng);
```

with:

```ts
onChange(fromLatLng(e.latlng));
```

Update `MapControlsProps`:

```ts
interface MapControlsProps {
  position: MapPoint | undefined;
}
```

Update `LocationPickerProps`:

```ts
interface LocationPickerProps {
  readonly?: boolean;
  latlng?: MapPoint;
  onChange?: (position: MapPoint) => void;
  className?: string;
}
```

Replace:

```ts
const DEFAULT_CENTER_LAT_LNG = new LatLng(48.8584, 2.2945);
```

with:

```ts
const DEFAULT_CENTER: MapPoint = { lat: 48.8584, lng: 2.2945 };
```

Inside `LocationPicker`, replace:

```ts
const position = latlng || DEFAULT_CENTER_LAT_LNG;
```

with:

```ts
const position = latlng || DEFAULT_CENTER;
const mapCenter = toLatLng(position);
const markerPosition = latlng ? toLatLng(latlng) : mapCenter;
```

Replace the `MapContainer` props and marker call:

```tsx
<MapContainer
  className="h-full w-full !bg-muted"
  center={mapCenter}
  zoom={13}
  scrollWheelZoom={false}
  zoomControl={false}
  attributionControl={false}
>
  <ThemedTileLayer />
  <LocationMarker position={markerPosition} readonly={readOnly} onChange={onChange} />
  <MapControls position={latlng} />
  <MapCleanup />
</MapContainer>
```

- [x] **Step 3: Keep the map barrel Leaflet-free**

Replace `web/src/components/map/index.ts` with:

```ts
export { useReverseGeocoding } from "./useReverseGeocoding";
```

Do not export `LocationPicker`, `LazyLocationPicker`, `map-utils`, or Leaflet helpers from this barrel. Import map UI directly from `@/components/map/LazyLocationPicker` or the implementation file.

- [x] **Step 4: Use lazy picker in `LocationDialog`**

In `web/src/components/MemoMetadata/Location/LocationDialog.tsx`:

Remove:

```ts
import type { LatLng } from "leaflet";
import { LocationPicker } from "@/components/map";
```

Add:

```ts
import { LazyLocationPicker } from "@/components/map/LazyLocationPicker";
import type { MapPoint } from "@/components/map/types";
```

Change the prop type:

```ts
onPositionChange: (position: MapPoint) => void;
```

Replace:

```tsx
<LocationPicker className="h-full" latlng={position} onChange={onPositionChange} />
```

with:

```tsx
{open && <LazyLocationPicker className="h-full" latlng={position} onChange={onPositionChange} />}
```

- [x] **Step 5: Use lazy picker in `LocationDisplayView`**

In `web/src/components/MemoMetadata/Location/LocationDisplayView.tsx`:

Remove:

```ts
import { LatLng } from "leaflet";
import { LocationPicker } from "@/components/map";
```

Add:

```ts
import { LazyLocationPicker } from "@/components/map/LazyLocationPicker";
```

Replace:

```tsx
<LocationPicker latlng={new LatLng(location.latitude, location.longitude)} readonly={true} />
```

with:

```tsx
{popoverOpen && <LazyLocationPicker latlng={{ lat: location.latitude, lng: location.longitude }} readonly={true} />}
```

- [x] **Step 6: Run lint**

Run:

```bash
cd web && pnpm lint
```

Expected: PASS for the files changed so far, or only failures unrelated to this work. Fix any `MapPoint`/`LatLng` type errors before continuing.

## Task 3: Lazy-Load Profile Map

**Files:**
- Modify: `web/src/pages/UserProfile.tsx`
- Modify: `web/src/components/UserMemoMap/UserMemoMap.tsx`

- [x] **Step 1: Move `UserMemoMap` behind `React.lazy`**

In `web/src/pages/UserProfile.tsx`, replace the React import section:

```ts
import copy from "copy-to-clipboard";
import { ExternalLinkIcon, LayoutListIcon, type LucideIcon, MapIcon } from "lucide-react";
import { toast } from "react-hot-toast";
```

with:

```ts
import copy from "copy-to-clipboard";
import { lazy, Suspense } from "react";
import { ExternalLinkIcon, LayoutListIcon, type LucideIcon, MapIcon } from "lucide-react";
import { toast } from "react-hot-toast";
```

Remove:

```ts
import UserMemoMap from "@/components/UserMemoMap";
```

Add after the `type TabView = "memos" | "map";` line:

```ts
const UserMemoMap = lazy(() => import("@/components/UserMemoMap"));
```

Replace:

```tsx
<div className="">
  <UserMemoMap creator={user.name} className="h-[60dvh] sm:h-[500px] rounded-xl" />
</div>
```

with:

```tsx
<div className="">
  <Suspense fallback={<div className="h-[60dvh] sm:h-[500px] rounded-xl border border-border bg-muted/30" />}>
    <UserMemoMap creator={user.name} className="h-[60dvh] sm:h-[500px] rounded-xl" />
  </Suspense>
</div>
```

- [x] **Step 2: Keep Leaflet CSS in the lazy profile map implementation**

In `web/src/components/UserMemoMap/UserMemoMap.tsx`, add the Leaflet CSS import above marker cluster CSS:

```ts
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
```

The file should continue to import Leaflet, React Leaflet, marker clustering, and `map-utils` directly because this component is now loaded only from a lazy boundary.

- [x] **Step 3: Run lint**

Run:

```bash
cd web && pnpm lint
```

Expected: PASS, or only unrelated pre-existing failures.

## Task 4: Move KaTeX CSS And Dynamically Import Mermaid

**Files:**
- Modify: `web/src/main.tsx`
- Modify: `web/src/components/MemoContent/MemoMarkdownRenderer.tsx`
- Modify: `web/src/components/MemoContent/MermaidBlock.tsx`

- [x] **Step 1: Remove feature CSS from app entry**

In `web/src/main.tsx`, remove:

```ts
import "leaflet/dist/leaflet.css";
import "katex/dist/katex.min.css";
```

- [x] **Step 2: Load KaTeX CSS from markdown renderer**

In `web/src/components/MemoContent/MemoMarkdownRenderer.tsx`, add this import with the existing dependency imports:

```ts
import "katex/dist/katex.min.css";
```

- [x] **Step 3: Remove static Mermaid import**

In `web/src/components/MemoContent/MermaidBlock.tsx`, remove:

```ts
import mermaid from "mermaid";
```

- [x] **Step 4: Replace Mermaid initialization/render effects with dynamic import**

In `web/src/components/MemoContent/MermaidBlock.tsx`, remove the existing Mermaid initialization effect:

```ts
useEffect(() => {
  mermaid.initialize({
    startOnLoad: false,
    theme: toMermaidTheme(currentTheme),
    securityLevel: "strict",
    fontFamily: "inherit",
    suppressErrorRendering: true,
  });
}, [currentTheme]);
```

Replace the existing render effect with:

```ts
useEffect(() => {
  if (!codeContent) return;

  let cancelled = false;

  const renderDiagram = async () => {
    try {
      const { default: mermaid } = await import("mermaid");
      if (cancelled) return;

      mermaid.initialize({
        startOnLoad: false,
        theme: toMermaidTheme(currentTheme),
        securityLevel: "strict",
        fontFamily: "inherit",
        suppressErrorRendering: true,
      });

      const id = `mermaid-${Math.random().toString(36).substring(7)}`;
      const { svg: renderedSvg } = await mermaid.render(id, codeContent);
      if (cancelled) return;

      setSvg(renderedSvg);
      setError("");
    } catch (err) {
      if (cancelled) return;
      console.error("Failed to render mermaid diagram:", err);
      setSvg("");
      setError(formatErrorMessage(err));
    }
  };

  renderDiagram();

  return () => {
    cancelled = true;
  };
}, [codeContent, currentTheme]);
```

- [x] **Step 5: Run lint**

Run:

```bash
cd web && pnpm lint
```

Expected: PASS, or only unrelated pre-existing failures.

## Task 4.5: Remove Remaining Entry Preloads Found During Verification

**Files:**
- Modify: `web/src/router/index.tsx`
- Modify: `web/vite.config.mts`

- [x] **Step 1: Lazy-load the Home route**

`web/src/router/index.tsx` now uses `lazyWithReload(() => import("@/pages/Home"))` instead of a static Home import. This prevents Home, `PagedMemoList`, `MemoEditor`, `MemoContent`, KaTeX, and Mermaid code from entering the auth/signup app entry graph.

- [x] **Step 2: Tighten optional vendor split groups**

`web/vite.config.mts` no longer defines a manual `mermaid-vendor` group, because Rolldown emitted the preload helper from that group and forced an entry preload. The Leaflet group now matches only the `leaflet` package, not `react-leaflet`, so React does not get bundled into a Leaflet-named entry preload.

- [x] **Step 3: Re-run lint and build**

Run:

```bash
cd web && pnpm lint && pnpm build
```

Expected: PASS.

## Task 5: Build And Verify Initial Network Behavior

**Files:**
- No source edits expected unless verification finds a regression.

- [x] **Step 1: Build production frontend**

Run:

```bash
cd web && pnpm build
```

Expected: PASS. Build output should still contain separate Mermaid and Leaflet chunks, but they should not be required by the auth/signup initial route.

- [x] **Step 2: Inspect build output for heavy chunks**

Run:

```bash
cd web && find dist/assets -maxdepth 1 -type f \( -name '*mermaid*' -o -name '*leaflet*' -o -name '*katex*' \) -print | sort
```

Expected: Mermaid and Leaflet assets may exist as lazy chunks. Their existence is fine; the goal is that auth/signup does not request them initially.

- [x] **Step 3: Start production preview**

Run:

```bash
cd web && pnpm exec vite preview --host 127.0.0.1 --port 4173
```

Expected: Preview server starts on `http://127.0.0.1:4173/`. Keep this session running until browser verification is complete.

- [x] **Step 4: Verify `/auth/signup` network with browser tooling**

Open:

```text
http://127.0.0.1:4173/auth/signup
```

Expected initial document and asset requests do not include filenames containing:

```text
mermaid
leaflet
```

If KaTeX CSS still appears on `/auth/signup`, inspect the chunk initiator and remove any remaining static import path that reaches `MemoMarkdownRenderer` from auth/signup.

- [ ] **Step 5: Smoke test feature lazy loading**

Use the running app or a local backend/dev setup to verify:

```text
1. A memo containing a Mermaid code block renders the diagram and requests the Mermaid chunk only when the memo content appears.
2. A memo containing inline or block math displays KaTeX styling when memo content appears.
3. Opening the location picker loads Leaflet assets and the picker remains interactive.
4. Opening a memo location popover loads Leaflet assets and shows the pinned map.
5. Opening `/u/:username?view=map` loads the profile map and marker cluster behavior still works.
```

Expected: Features behave as before after their lazy chunks load.

Result in this session: live feature smoke was not completed because the production preview has no authenticated backend session or seeded memo data. Static verification confirmed the relevant feature chunks still exist and load paths are behind lazy imports.

- [x] **Step 6: Stop preview server**

Stop the preview command from Step 3 with `Ctrl-C`.

## Task 6: Commit Implementation

**Files:**
- All source files modified by Tasks 1-4.

- [x] **Step 1: Review final diff**

Run:

```bash
git diff -- web/src/main.tsx web/src/components/map web/src/components/MemoEditor web/src/components/MemoMetadata/Location web/src/pages/UserProfile.tsx web/src/components/MemoContent web/src/components/UserMemoMap/UserMemoMap.tsx
```

Expected: Diff is limited to lazy-loading heavy optional dependencies and plain coordinate type changes.

- [x] **Step 2: Run final verification**

Run:

```bash
cd web && pnpm lint && pnpm build
```

Expected: PASS.

- [x] **Step 3: Commit**

Run:

```bash
git add web/src/main.tsx web/src/components/map web/src/components/MemoEditor web/src/components/MemoMetadata/Location web/src/pages/UserProfile.tsx web/src/components/MemoContent web/src/components/UserMemoMap/UserMemoMap.tsx
git commit -m "perf: lazy load heavy first-screen dependencies"
```

Expected: Commit succeeds with only the intended source changes.

## Self-Review

- Spec coverage: The plan removes global Leaflet/KaTeX CSS, dynamically imports Mermaid, lazy-loads map UI, keeps Leaflet types out of parent boundaries, and verifies auth/signup network behavior.
- Placeholder scan: No placeholder markers, unresolved decisions, or vague generic handling steps remain.
- Type consistency: `MapPoint` is the shared parent-facing coordinate type; `LatLng` remains internal to `LocationPicker` and map implementation files only.
