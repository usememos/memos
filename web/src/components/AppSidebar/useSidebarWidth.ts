import { useCallback, useEffect, useState } from "react";

/**
 * Custom property the layout shell publishes so the rail and the main padding stay in sync.
 * Tailwind cannot read this constant, so `RootLayout` repeats the literal name in its
 * `w-(--app-sidebar-width)` / `md:pl-(--app-sidebar-width)` classes — keep the two in step.
 */
export const SIDEBAR_WIDTH_VAR = "--app-sidebar-width";

/** 200px of content once `px-3` is removed, which keeps the month calendar's seven cells legible. */
export const SIDEBAR_MIN_WIDTH = 224;
/** Wider than this only starves the feed: its columns need 260px each and the rail holds short labels. */
export const SIDEBAR_MAX_WIDTH = 400;
export const SIDEBAR_DEFAULT_WIDTH = 256;

/** The rail may never take more than this share of the window. */
const MAX_VIEWPORT_SHARE = 0.4;

export interface PersistedWidthConfig {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  /** The widest the panel may be in a window this wide; the result is floored at `minWidth`. */
  maxWidthFor: (viewportWidth: number) => number;
}

const viewportMaxWidth = ({ minWidth, maxWidthFor }: PersistedWidthConfig): number => {
  if (typeof window === "undefined") return minWidth;
  return Math.max(minWidth, Math.round(maxWidthFor(window.innerWidth)));
};

const readStoredWidth = ({ storageKey, defaultWidth }: PersistedWidthConfig): number => {
  try {
    const stored = Number(localStorage.getItem(storageKey));
    if (Number.isFinite(stored) && stored > 0) return stored;
  } catch (error) {
    console.warn(`Failed to load ${storageKey} from localStorage:`, error);
  }
  return defaultWidth;
};

/**
 * A resizable rail's width: a persisted preference, capped by whatever the current window can
 * spare. Read synchronously on mount so a stored width never flashes past the default.
 */
export const usePersistedWidth = (config: PersistedWidthConfig) => {
  const [preferredWidth, setPreferredWidth] = useState(() => readStoredWidth(config));
  const [maxWidth, setMaxWidth] = useState(() => viewportMaxWidth(config));
  const { storageKey, minWidth } = config;

  useEffect(() => {
    const handleResize = () => setMaxWidth(viewportMaxWidth(config));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [config]);

  // A narrow window caps what is rendered but leaves the stored preference alone, so widening
  // the window restores the width the user actually chose.
  const width = Math.min(Math.max(preferredWidth, minWidth), maxWidth);

  const setWidth = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(Math.round(next), minWidth), maxWidth);
      setPreferredWidth(clamped);
      try {
        localStorage.setItem(storageKey, String(clamped));
      } catch (error) {
        console.warn(`Failed to persist ${storageKey}:`, error);
      }
    },
    [storageKey, minWidth, maxWidth],
  );

  return { width, minWidth, maxWidth, setWidth };
};

const SIDEBAR_WIDTH_CONFIG: PersistedWidthConfig = {
  storageKey: "memos-sidebar-width",
  defaultWidth: SIDEBAR_DEFAULT_WIDTH,
  minWidth: SIDEBAR_MIN_WIDTH,
  maxWidthFor: (viewportWidth) => Math.min(SIDEBAR_MAX_WIDTH, viewportWidth * MAX_VIEWPORT_SHARE),
};

/** Desktop rail width. */
const useSidebarWidth = () => usePersistedWidth(SIDEBAR_WIDTH_CONFIG);

export default useSidebarWidth;
