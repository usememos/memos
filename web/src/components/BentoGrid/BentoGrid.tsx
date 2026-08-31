import { type ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react";
import { columnCountForWidth, GRID_GAP } from "@/components/ColumnGrid";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { BENTO_ROW_UNIT, BENTO_ROW_UNIT_SMALL, BENTO_SMALL_WIDTH, bentoSpan } from "./bentoSpan";

interface BentoGridProps {
  items: Memo[];
  /** Stable identity for each item; also used as the React key. */
  getKey: (item: Memo) => string;
  renderItem: (item: Memo) => ReactNode;
  /** Optional node packed as the first full-width row (e.g. the note composer). */
  leading?: ReactNode;
  /** Key rendered as the first item tile, ahead of list order. */
  priorityKey?: string;
  /** Upper bound on the column count; 0 or undefined means as many as fit. */
  maxColumns?: number;
  /** Cap on each column's width in px; leftover space centers the grid. */
  maxColumnWidth?: number;
}

interface GridLayout {
  count: number;
  columnWidth: number;
  rowUnit: number;
  gridWidth: number;
}

const layoutFor = (width: number, maxColumns?: number, maxColumnWidth?: number): GridLayout => {
  const fit = columnCountForWidth(width);
  const count = Math.max(1, maxColumns && maxColumns > 0 ? Math.min(fit, maxColumns) : fit);
  const columnWidth = count > 1 ? Math.floor((width - GRID_GAP * (count - 1)) / count) : width;
  const clampedWidth = maxColumnWidth != null ? Math.min(columnWidth, maxColumnWidth) : columnWidth;
  return {
    count,
    columnWidth: clampedWidth,
    rowUnit: width < BENTO_SMALL_WIDTH ? BENTO_ROW_UNIT_SMALL : BENTO_ROW_UNIT,
    gridWidth: clampedWidth * count + GRID_GAP * Math.max(0, count - 1),
  };
};

/**
 * Bento layout: a CSS grid with dense auto-flow, where tiles span columns and rows
 * deterministically from memo data (see bentoSpan). Unlike ColumnGrid's translated
 * masonry, spans live entirely in CSS — `grid-auto-flow: dense` backfills holes, so
 * visual order may differ from DOM (keyboard focus) order, exactly like masonry.
 */
const BentoGrid = ({ items, getKey, renderItem, leading, priorityKey, maxColumns, maxColumnWidth }: BentoGridProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<GridLayout>(() => layoutFor(Number.POSITIVE_INFINITY, maxColumns, maxColumnWidth));

  // Only the derived layout is stored, so continuous resizes re-render nothing until a
  // column count, row unit, or clamped width bound actually flips.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const apply = (width: number) => {
      const next = layoutFor(width, maxColumns, maxColumnWidth);
      setLayout((prev) =>
        prev.count === next.count && prev.columnWidth === next.columnWidth && prev.rowUnit === next.rowUnit ? prev : next,
      );
    };
    apply(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => apply(entries[0]?.contentRect.width ?? el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [maxColumns, maxColumnWidth]);

  const orderedItems = useMemo(() => {
    if (!priorityKey) return items;
    const priority = items.find((item) => getKey(item) === priorityKey);
    if (!priority) return items;
    return [priority, ...items.filter((item) => getKey(item) !== priorityKey)];
  }, [items, getKey, priorityKey]);

  return (
    <div
      ref={containerRef}
      className="mx-auto w-full"
      style={{
        display: "grid",
        gap: GRID_GAP,
        gridTemplateColumns: `repeat(${layout.count}, minmax(0, 1fr))`,
        gridAutoRows: `${layout.rowUnit}px`,
        gridAutoFlow: "dense",
        maxWidth: layout.gridWidth || undefined,
      }}
    >
      {leading != null && <div style={{ gridColumn: "1 / -1" }}>{leading}</div>}
      {orderedItems.map((item) => {
        const key = getKey(item);
        const { colSpan, rowSpan } = bentoSpan(item, {
          columnCount: layout.count,
          columnWidth: layout.columnWidth,
          rowUnit: layout.rowUnit,
        });
        return (
          <div
            key={key}
            className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg [&>*]:mb-0 [&>*]:flex-1"
            style={{
              gridColumn: `span ${Math.min(colSpan, layout.count)}`,
              gridRow: `span ${rowSpan}`,
            }}
          >
            {renderItem(item)}
          </div>
        );
      })}
    </div>
  );
};

export default BentoGrid;
