import { useEffect, useRef } from "react";
import { MasonryItemProps } from "./types";

/**
 * Individual item wrapper component for masonry layout
 *
 * Responsibilities:
 * - Render the memo using the provided renderer with context
 * - Measure its own height using ResizeObserver
 * - Report height changes to parent for redistribution
 *
 * The ResizeObserver automatically tracks dynamic content changes such as:
 * - Images loading
 * - Expanded/collapsed text
 * - Any other content size changes
 */
export function MasonryItem({ memo, renderer, renderContext, onHeightChange }: MasonryItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!itemRef.current) return;

    const measureHeight = () => {
      if (itemRef.current) {
        const height = itemRef.current.offsetHeight;
        onHeightChange(memo.name, height);
      }
    };

    // Initial measurement
    measureHeight();

    // Set up ResizeObserver to track dynamic content changes
    resizeObserverRef.current = new ResizeObserver(measureHeight);
    resizeObserverRef.current.observe(itemRef.current);

    // Cleanup on unmount
    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [memo.name, onHeightChange]);

  return <div ref={itemRef}>{renderer(memo, renderContext)}</div>;
}
