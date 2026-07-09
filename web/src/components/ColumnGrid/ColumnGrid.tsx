import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

interface ColumnGridProps<T> {
  items: T[];
  /** Stable identity for each item; also used as the React key. */
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** Estimated rendered height in px, used only to choose a column deterministically. */
  estimateHeight?: (item: T, context: { columnWidth: number }) => number;
  /** Optional node packed as the very first tile (e.g. the note composer). */
  leading?: ReactNode;
  /** Key that must land at the top of column one (e.g. a just-created memo), not the shortest column. */
  priorityKey?: string;
  /** Upper bound on the column count; 0 or undefined means as many as fit. */
  maxColumns?: number;
  /** Cap on each column's width in px; leftover space centers the grid. */
  maxColumnWidth?: number;
}

const LEADING_KEY = "__grid_leading__";

const GRID_MIN_COLUMN_WIDTH = 260;
export const GRID_GAP = 12;

// The single source of truth for how many columns fit a given width. Callers use it to detect a
// one-column layout and fall back to a plain flow list instead of a degenerate one-column grid.
export const columnCountForWidth = (width: number): number =>
  Math.max(1, Math.floor((width + GRID_GAP) / (GRID_MIN_COLUMN_WIDTH + GRID_GAP)));

const shortestColumn = (heights: number[]): number => {
  let index = 0;
  for (let i = 1; i < heights.length; i++) {
    if (heights[i] < heights[index]) {
      index = i;
    }
  }
  return index;
};

export const assignColumnsByEstimatedHeight = ({
  keys,
  columnCount,
  getEstimatedHeight,
  pinnedKeys,
}: {
  keys: string[];
  columnCount: number;
  getEstimatedHeight: (key: string) => number;
  pinnedKeys?: ReadonlySet<string>;
}): Map<string, number> => {
  const totals = new Array<number>(columnCount).fill(0);
  const columns = new Map<string, number>();

  for (const key of keys) {
    const column = pinnedKeys?.has(key) ? 0 : shortestColumn(totals);
    columns.set(key, column);
    totals[column] += Math.max(0, getEstimatedHeight(key));
  }

  return columns;
};

/**
 * Absolute-positioned column grid (Google-Keep-style packing). Cards keep their document
 * order and are only translated into place, so appending pages or reordering the list
 * never remounts a card — preserving its state and avoiding flashes.
 *
 * Columns are assigned from deterministic estimated heights. Real measured heights only decide
 * each card's final y offset inside its assigned column, so late image/comment growth moves cards
 * down within that column without reshuffling cards across columns.
 */
function ColumnGrid<T>({
  items,
  getKey,
  renderItem,
  estimateHeight,
  leading,
  priorityKey,
  maxColumns,
  maxColumnWidth,
}: ColumnGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const refCallbacks = useRef<Map<string, (el: HTMLDivElement | null) => void>>(new Map());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastWidthRef = useRef(0);
  const [containerHeight, setContainerHeight] = useState<number | undefined>(undefined);

  // Measure each card once (widths written in one pass, heights read in the next so the
  // browser reflows once), assign cards by estimated height, then translate every card to its
  // column's measured running offset.
  const relayout = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    // What fits (each column >= the minimum width), then the user's max-columns ceiling on top.
    const fit = columnCountForWidth(width);
    const count = maxColumns && maxColumns > 0 ? Math.min(fit, maxColumns) : fit;
    // Whole-pixel columns that fill the row, clamped to maxColumnWidth so few columns on a
    // wide screen stay readable instead of stretching.
    let columnWidth = count > 1 ? Math.floor((width - GRID_GAP * (count - 1)) / count) : width;
    if (maxColumnWidth != null) columnWidth = Math.min(columnWidth, maxColumnWidth);
    // Center the packed columns in whatever width the clamp leaves over.
    const offsetX = Math.floor((width - (columnWidth * count + GRID_GAP * (count - 1))) / 2);

    // Ordered by feed position: the leading tile (composer) first, then items.
    const ordered: { key: string; el: HTMLDivElement }[] = [];
    const leadingEl = itemRefs.current.get(LEADING_KEY);
    if (leadingEl) ordered.push({ key: LEADING_KEY, el: leadingEl });
    const itemByKey = new Map<string, T>();
    for (const item of items) {
      const key = getKey(item);
      itemByKey.set(key, item);
      const el = itemRefs.current.get(key);
      if (el) ordered.push({ key, el });
    }

    // Pass 1 (writes): fix each card's width and drop its own bottom margin so spacing is
    // owned entirely by `gap`. `firstElementChild` is the item's rendered root. Items are
    // expected to bound their own height — the grid never clips content itself.
    for (const { el } of ordered) {
      el.style.width = `${columnWidth}px`;
      const child = el.firstElementChild;
      if (child instanceof HTMLElement) {
        child.style.marginBottom = "0px";
      }
    }

    // Pass 2 (reads): height of every card, measured once after the width writes so the
    // browser reflows a single time. We read the inner element, not the absolutely-positioned
    // wrapper (whose block-formatting context would fold in margins).
    const heightByKey = new Map<string, number>();
    for (const { key, el } of ordered) {
      const child = el.firstElementChild;
      heightByKey.set(key, child instanceof HTMLElement ? child.offsetHeight : el.offsetHeight);
    }
    const heightOf = (key: string) => heightByKey.get(key) ?? 0;

    const pinnedKeys = new Set<string>([LEADING_KEY]);
    if (priorityKey) {
      pinnedKeys.add(priorityKey);
    }
    const columnOf = assignColumnsByEstimatedHeight({
      keys: ordered.map((entry) => entry.key),
      columnCount: count,
      pinnedKeys,
      getEstimatedHeight: (key) => {
        const item = itemByKey.get(key);
        return item && estimateHeight ? estimateHeight(item, { columnWidth }) : heightOf(key);
      },
    });

    const columnY = new Array<number>(count).fill(0);
    const pos = new Map<string, { x: number; y: number }>();
    for (const { key } of ordered) {
      const col = columnOf.get(key) ?? 0;
      const x = offsetX + col * (columnWidth + GRID_GAP);
      const y = columnY[col];
      pos.set(key, { x, y });
      columnY[col] = y + heightOf(key) + GRID_GAP;
    }

    // Apply the chosen positions without transitions. Relayouts may be caused by late media or
    // comment preview height changes, and those should never visibly animate cards across the wall.
    for (const { key, el } of ordered) {
      const target = pos.get(key);
      if (!target) continue;
      // The leading tile (the note composer) is positioned with left/top rather than a
      // transform so it never becomes the containing block for its own position:fixed
      // descendants. A transform (or will-change:transform) here would trap the editor's
      // focus-mode overlay — which is meant to cover the viewport — inside this column tile.
      // The leading tile is pinned to column one's top and only shifts horizontally on
      // resize (which snaps anyway), so it loses no animation by skipping the transform.
      if (key === LEADING_KEY) {
        el.style.transition = "none";
        el.style.transform = "";
        el.style.left = `${target.x}px`;
        el.style.top = `${target.y}px`;
        continue;
      }
      el.style.transition = "none";
      el.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
    }

    setContainerHeight(Math.max(0, ...columnY.map((h) => h - GRID_GAP)));
  }, [items, getKey, estimateHeight, priorityKey, maxColumns, maxColumnWidth]);

  // Keep a stable reference so observer callbacks always run the latest layout.
  const relayoutRef = useRef(relayout);
  relayoutRef.current = relayout;

  const scheduleRelayout = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      relayoutRef.current();
    });
  }, []);

  // Re-layout on container resize (sidebar toggles, window resize, breakpoints).
  // Only width matters — height changes are our own (we set the container height),
  // so ignoring them avoids a feedback loop of redundant re-packs.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    lastWidthRef.current = container.clientWidth;
    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.round(entries[0]?.contentRect.width ?? container.clientWidth);
      if (nextWidth !== lastWidthRef.current) {
        lastWidthRef.current = nextWidth;
        scheduleRelayout();
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [scheduleRelayout]);

  // A single observer watches every card so late-loading images (which change a
  // card's height) trigger a re-pack.
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => scheduleRelayout());
    resizeObserverRef.current = observer;
    for (const el of itemRefs.current.values()) observer.observe(el);
    return () => {
      observer.disconnect();
      resizeObserverRef.current = null;
    };
  }, [scheduleRelayout]);

  // Re-pack after DOM updates (items added/removed/reordered), before paint.
  useLayoutEffect(() => {
    relayout();
  }, [relayout]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const getItemRef = (key: string) => {
    const cached = refCallbacks.current.get(key);
    if (cached) return cached;
    const callback = (el: HTMLDivElement | null) => {
      const map = itemRefs.current;
      const previous = map.get(key);
      if (previous && resizeObserverRef.current) resizeObserverRef.current.unobserve(previous);
      if (el) {
        map.set(key, el);
        resizeObserverRef.current?.observe(el);
      } else {
        map.delete(key);
        refCallbacks.current.delete(key);
      }
    };
    refCallbacks.current.set(key, callback);
    return callback;
  };

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: containerHeight }}>
      {leading != null && (
        // Positioned with left/top (see relayout), and deliberately WITHOUT
        // transform/will-change so it never establishes a containing block that would trap
        // the composer's focus-mode overlay inside this tile.
        <div key={LEADING_KEY} ref={getItemRef(LEADING_KEY)} className="absolute top-0 left-0">
          {leading}
        </div>
      )}
      {items.map((item) => {
        const key = getKey(item);
        return (
          <div
            key={key}
            ref={getItemRef(key)}
            className="absolute top-0 left-0 transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{ willChange: "transform" }}
          >
            {renderItem(item)}
          </div>
        );
      })}
    </div>
  );
}

export default ColumnGrid;
