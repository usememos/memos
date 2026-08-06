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

const STORAGE_KEY = "memos-sidebar-width";

const viewportMaxWidth = (): number => {
  if (typeof window === "undefined") return SIDEBAR_MAX_WIDTH;
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, Math.round(window.innerWidth * MAX_VIEWPORT_SHARE)));
};

const readStoredWidth = (): number => {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(stored) && stored > 0) return stored;
  } catch (error) {
    console.warn("Failed to load sidebar width from localStorage:", error);
  }
  return SIDEBAR_DEFAULT_WIDTH;
};

/**
 * Desktop rail width: a persisted preference, capped by whatever the current window can spare.
 * Read synchronously on mount so a stored width never flashes past the default.
 */
const useSidebarWidth = () => {
  const [preferredWidth, setPreferredWidth] = useState(readStoredWidth);
  const [maxWidth, setMaxWidth] = useState(viewportMaxWidth);

  useEffect(() => {
    const handleResize = () => setMaxWidth(viewportMaxWidth());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // A narrow window caps what is rendered but leaves the stored preference alone, so widening
  // the window restores the width the user actually chose.
  const width = Math.min(Math.max(preferredWidth, SIDEBAR_MIN_WIDTH), maxWidth);

  const setWidth = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(Math.round(next), SIDEBAR_MIN_WIDTH), maxWidth);
      setPreferredWidth(clamped);
      try {
        localStorage.setItem(STORAGE_KEY, String(clamped));
      } catch (error) {
        console.warn("Failed to persist sidebar width:", error);
      }
    },
    [maxWidth],
  );

  return { width, minWidth: SIDEBAR_MIN_WIDTH, maxWidth, setWidth };
};

export default useSidebarWidth;
