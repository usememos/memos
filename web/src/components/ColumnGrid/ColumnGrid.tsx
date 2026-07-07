import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

interface ColumnGridProps<T> {
  items: T[];
  /** Stable identity for each item; also used as the React key. */
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
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

/**
 * Absolute-positioned column grid (Google-Keep-style packing). Cards keep their document
 * order and are only translated into place, so appending pages or reordering the list
 * never remounts a card — preserving its state and avoiding flashes.
 *
 * Columns are assigned incrementally and stick: a new card goes into the currently
 * shortest column and stays there. Existing cards never switch columns, so creating a
 * memo (or a card growing when its image loads) only shifts the one affected column —
 * never the whole wall. Balance holds because every new card fills the shortest column.
 */
function ColumnGrid<T>({ items, getKey, renderItem, leading, priorityKey, maxColumns, maxColumnWidth }: ColumnGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const refCallbacks = useRef<Map<string, (el: HTMLDivElement | null) => void>>(new Map());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastWidthRef = useRef(0);
  // Sticky column per card key: once assigned, a card never changes column, so adding
  // or editing memos never reshuffles the whole wall. Reset only when the column count changes.
  const assignmentsRef = useRef<Map<string, number>>(new Map());
  const assignedColumnCountRef = useRef(0);
  const [containerHeight, setContainerHeight] = useState<number | undefined>(undefined);

  // Measure each card once (widths written in one pass, heights read in the next so the
  // browser reflows once), assign only new cards to the shortest column, then translate
  // every card to its column's running offset. Existing assignments are reused verbatim.
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
    for (const item of items) {
      const key = getKey(item);
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

    const assignments = assignmentsRef.current;
    // A column-count change (resize/breakpoint) is the only time we re-pack from scratch.
    if (assignedColumnCountRef.current !== count) {
      assignments.clear();
      assignedColumnCountRef.current = count;
    }
    // Forget cards that no longer exist so their column frees up.
    const liveKeys = new Set(ordered.map((entry) => entry.key));
    for (const key of assignments.keys()) {
      if (!liveKeys.has(key)) assignments.delete(key);
    }

    // Assign only unassigned cards, into the column that is shortest right now. Existing
    // cards keep their column, so nothing else moves between columns.
    const totals = new Array<number>(count).fill(0);
    for (const { key } of ordered) {
      const col = assignments.get(key);
      if (col != null) totals[col] += heightOf(key);
    }
    for (const { key } of ordered) {
      if (assignments.has(key)) continue;
      // The leading tile and a just-created memo belong at the top of column one (the action
      // column), regardless of mount timing; every other new card balances into the shortest
      // column. `ordered` places leading first, so it stays above the priority memo.
      const col = key === priorityKey || key === LEADING_KEY ? 0 : shortestColumn(totals);
      assignments.set(key, col);
      totals[col] += heightOf(key);
    }

    // Stack each column's cards in feed order.
    const columnY = new Array<number>(count).fill(0);
    for (const { key, el } of ordered) {
      const col = assignments.get(key) ?? 0;
      const x = offsetX + col * (columnWidth + GRID_GAP);
      const y = columnY[col];
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      columnY[col] = y + heightOf(key) + GRID_GAP;
    }

    setContainerHeight(Math.max(0, ...columnY.map((h) => h - GRID_GAP)));
  }, [items, getKey, priorityKey, maxColumns, maxColumnWidth]);

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
        <div key={LEADING_KEY} ref={getItemRef(LEADING_KEY)} className="absolute top-0 left-0" style={{ willChange: "transform" }}>
          {leading}
        </div>
      )}
      {items.map((item) => {
        const key = getKey(item);
        return (
          <div key={key} ref={getItemRef(key)} className="absolute top-0 left-0" style={{ willChange: "transform" }}>
            {renderItem(item)}
          </div>
        );
      })}
    </div>
  );
}

export default ColumnGrid;
