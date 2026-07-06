import { type RefObject, useEffect, useState } from "react";

/** Below this content width (px) the formatting toolbar uses its compact layout. */
export const COMPACT_TOOLBAR_WIDTH = 380;

/** Pure decision so it can be unit-tested without a DOM. Width 0 = unmeasured. */
export function isCompactWidth(width: number): boolean {
  return width > 0 && width < COMPACT_TOOLBAR_WIDTH;
}

/**
 * Tracks an element's content-box width via ResizeObserver. Returns 0 until the
 * first measurement (or when ResizeObserver is unavailable, e.g. jsdom), which
 * isCompactWidth() treats as the full (non-compact) layout.
 */
export function useElementWidth<T extends HTMLElement>(ref: RefObject<T | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(element);
    setWidth(element.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
