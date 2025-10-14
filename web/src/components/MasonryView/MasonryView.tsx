import { useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { MasonryColumn } from "./MasonryColumn";
import { MasonryViewProps, MemoRenderContext } from "./types";
import { useMasonryLayout } from "./useMasonryLayout";

/**
 * Masonry layout component for displaying memos in a balanced, multi-column grid
 *
 * Features:
 * - Responsive column count based on viewport width
 * - Longest Processing-Time First (LPT) algorithm for optimal distribution
 * - Pins editor and first memo to first column for stability
 * - Debounced redistribution for performance
 * - Automatic height tracking with ResizeObserver
 * - Auto-enables compact mode in multi-column layouts
 *
 * The layout automatically adjusts to:
 * - Window resizing
 * - Content changes (images loading, text expansion)
 * - Dynamic memo additions/removals
 *
 * Algorithm guarantee: Layout is never more than 34% longer than optimal (proven)
 */
const MasonryView = ({ memoList, renderer, prefixElement, listMode = false }: MasonryViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefixElementRef = useRef<HTMLDivElement>(null);

  const { columns, distribution, handleHeightChange } = useMasonryLayout(memoList, listMode, containerRef, prefixElementRef);

  // Create render context: automatically enable compact mode when multiple columns
  const renderContext: MemoRenderContext = useMemo(
    () => ({
      compact: columns > 1,
      columns,
    }),
    [columns],
  );

  return (
    <div
      ref={containerRef}
      className={cn("w-full grid gap-2")}
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
      }}
    >
      {Array.from({ length: columns }).map((_, columnIndex) => (
        <MasonryColumn
          key={columnIndex}
          memoIndices={distribution[columnIndex] || []}
          memoList={memoList}
          renderer={renderer}
          renderContext={renderContext}
          onHeightChange={handleHeightChange}
          isFirstColumn={columnIndex === 0}
          prefixElement={prefixElement}
          prefixElementRef={prefixElementRef}
        />
      ))}
    </div>
  );
};

export default MasonryView;
