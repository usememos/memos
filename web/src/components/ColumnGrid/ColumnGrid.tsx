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

// A from-scratch re-pack is adopted only when it shrinks the column-height spread by at least
// this much, so a genuine late-growth imbalance heals but a trivial few-pixel gain never
// reshuffles the wall. There is no absolute-drift trigger, so even a small late growth rebalances
// as long as re-packing actually helps.
const REPACK_MIN_IMPROVEMENT = 32;

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

// Spread between the tallest and shortest column. Operates on the per-column heights (a small
// array sized to the column count), so the spread is cheap.
const driftOf = (columnHeights: number[]): number => Math.max(...columnHeights) - Math.min(...columnHeights);

/**
 * Absolute-positioned column grid (Google-Keep-style packing). Cards keep their document
 * order and are only translated into place, so appending pages or reordering the list
 * never remounts a card — preserving its state and avoiding flashes.
 *
 * Columns are assigned incrementally and stick: a new card goes into the currently shortest
 * column and stays there, so appending a page or a card growing only shifts that one column,
 * not the whole wall. The exception is the self-heal below: when a late height change (an image
 * or comment loading after a card's column was fixed) leaves the columns lopsided, a full re-pack
 * is adopted and those cards animate to their new columns — the only time cards move between
 * columns, and the only relayout that animates.
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
  // Cards positioned at least once. A card's first placement skips the CSS transition so it
  // doesn't visibly slide in from the top-left corner.
  const positionedKeysRef = useRef<Set<string>>(new Set());
  // Last column width, so a resize (width change) can be detected and applied instantly: an eased
  // x-offset would lag behind the width, which is always written to `el.style.width` immediately.
  const lastColumnWidthRef = useRef(0);
  const [containerHeight, setContainerHeight] = useState<number | undefined>(undefined);

  // Measure each card once (widths written in one pass, heights read in the next so the
  // browser reflows once), assign only new cards to the shortest column, then translate
  // every card to its column's running offset. Existing assignments are reused; a from-scratch
  // re-pack happens only on a column-count change or to heal drift left by a card that grew
  // after its column was fixed.
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
    // Structural changes (column count or width) re-lay-out crisply, with no animation: the width
    // is written to `el.style.width` instantly, so an eased x-offset would lag behind it.
    const countChanged = assignedColumnCountRef.current !== count;
    const widthChanged = columnWidth !== lastColumnWidthRef.current;
    lastColumnWidthRef.current = columnWidth;
    // A column-count change (resize/breakpoint) forces a re-pack from scratch.
    if (countChanged) {
      assignments.clear();
      assignedColumnCountRef.current = count;
    }
    // Forget cards that no longer exist so their column frees up.
    const liveKeys = new Set(ordered.map((entry) => entry.key));
    for (const key of assignments.keys()) {
      if (!liveKeys.has(key)) assignments.delete(key);
    }

    // Plan a layout from a starting set of sticky column assignments, without touching the DOM.
    // Unassigned cards drop into the column that is shortest right now; the leading tile and the
    // just-created memo pin to column one. Non-priority placements are persisted back into
    // `sticky` so they stay put on later passes, but the priority pin is left transient — a
    // superseded memo rebalances on its next pass instead of piling up in column one forever.
    const plan = (sticky: Map<string, number>) => {
      const totals = new Array<number>(count).fill(0);
      const columnOf = new Map<string, number>();
      for (const { key } of ordered) {
        const col = sticky.get(key);
        if (col != null) {
          totals[col] += heightOf(key);
          columnOf.set(key, col);
        }
      }
      for (const { key } of ordered) {
        if (columnOf.has(key)) continue;
        // `ordered` places leading first, so it stays above the priority memo in column one.
        const col = key === priorityKey || key === LEADING_KEY ? 0 : shortestColumn(totals);
        totals[col] += heightOf(key);
        columnOf.set(key, col);
        if (key !== priorityKey) sticky.set(key, col);
      }
      // Stack each column's cards in feed order, recording each card's target position.
      const columnY = new Array<number>(count).fill(0);
      const pos = new Map<string, { x: number; y: number }>();
      for (const { key } of ordered) {
        const col = columnOf.get(key) ?? 0;
        const x = offsetX + col * (columnWidth + GRID_GAP);
        const y = columnY[col];
        pos.set(key, { x, y });
        columnY[col] = y + heightOf(key) + GRID_GAP;
      }
      return { columnY, pos };
    };

    // Incremental pass: keep existing columns, place only the new cards.
    let layout = plan(assignments);
    // Self-heal: a card that grew after its column was fixed (a late image/comment) leaves the
    // columns lopsided, and the sticky rule can't undo it. Re-pack from a clean slate and adopt it
    // only when it shrinks the spread by a worthwhile margin — so an unavoidable imbalance (forced
    // column-one content, or fewer memos than columns) can't reshuffle the wall. The second plan()
    // is cheap in-memory work; the once-per-pass DOM measurement above dominates.
    let animateRepack = false;
    const currentDrift = driftOf(layout.columnY);
    if (count > 1 && currentDrift > REPACK_MIN_IMPROVEMENT) {
      const rebalanced = new Map<string, number>();
      const fresh = plan(rebalanced);
      if (driftOf(fresh.columnY) + REPACK_MIN_IMPROVEMENT < currentDrift) {
        assignmentsRef.current = rebalanced;
        layout = fresh;
        // Animate the rebalance only when the layout is otherwise stable. During a resize the
        // positions must snap so they stay in lockstep with the instantly-applied widths.
        animateRepack = !countChanged && !widthChanged;
      }
    }

    // Apply the chosen positions. Only an adopted re-pack on an otherwise-stable layout animates;
    // first placement, resizes, growth reflows and column-count changes all snap instantly. The
    // transition is suppressed on a card's first placement so it never slides in from 0,0.
    for (const { key, el } of ordered) {
      const target = layout.pos.get(key);
      if (!target) continue;
      const firstPlacement = !positionedKeysRef.current.has(key);
      if (firstPlacement) positionedKeysRef.current.add(key);
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
      el.style.transition = animateRepack && !firstPlacement ? "" : "none";
      el.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
    }

    setContainerHeight(Math.max(0, ...layout.columnY.map((h) => h - GRID_GAP)));
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
        // A re-added card should animate in fresh, not slide from its old transform.
        positionedKeysRef.current.delete(key);
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
