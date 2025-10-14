import { useCallback, useEffect, useRef, useState } from "react";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { MINIMUM_MEMO_VIEWPORT_WIDTH, REDISTRIBUTION_DEBOUNCE_MS } from "./constants";
import { distributeItemsToColumns } from "./distributeItems";

/**
 * Custom hook for managing masonry layout state and logic
 *
 * Responsibilities:
 * - Calculate optimal number of columns based on viewport width
 * - Track item heights and trigger redistribution
 * - Debounce redistribution to prevent excessive reflows
 * - Handle window resize events
 *
 * @param memoList - Array of memos to layout
 * @param listMode - Force single column mode
 * @param containerRef - Reference to the container element
 * @param prefixElementRef - Reference to the prefix element
 * @returns Layout state and handlers
 */
export function useMasonryLayout(
  memoList: Memo[],
  listMode: boolean,
  containerRef: React.RefObject<HTMLDivElement>,
  prefixElementRef: React.RefObject<HTMLDivElement>,
) {
  const [columns, setColumns] = useState(1);
  const [itemHeights, setItemHeights] = useState<Map<string, number>>(new Map());
  const [distribution, setDistribution] = useState<number[][]>([[]]);

  const redistributionTimeoutRef = useRef<number | null>(null);
  const itemHeightsRef = useRef<Map<string, number>>(itemHeights);

  // Keep ref in sync with state
  useEffect(() => {
    itemHeightsRef.current = itemHeights;
  }, [itemHeights]);

  /**
   * Calculate optimal number of columns based on container width
   * Uses a scale factor to determine column count
   */
  const calculateColumns = useCallback(() => {
    if (!containerRef.current || listMode) return 1;

    const containerWidth = containerRef.current.offsetWidth;
    const scale = containerWidth / MINIMUM_MEMO_VIEWPORT_WIDTH;
    return scale >= 2 ? Math.round(scale) : 1;
  }, [containerRef, listMode]);

  /**
   * Recalculate memo distribution when layout changes
   */
  const redistributeMemos = useCallback(() => {
    const prefixHeight = prefixElementRef.current?.offsetHeight || 0;
    setDistribution(() => {
      const { distribution: newDistribution } = distributeItemsToColumns(memoList, columns, itemHeightsRef.current, prefixHeight);
      return newDistribution;
    });
  }, [memoList, columns, prefixElementRef]);

  /**
   * Debounced redistribution to batch multiple height changes and prevent excessive reflows
   */
  const debouncedRedistribute = useCallback(
    (newItemHeights: Map<string, number>) => {
      // Clear any pending redistribution
      if (redistributionTimeoutRef.current) {
        clearTimeout(redistributionTimeoutRef.current);
      }

      // Schedule new redistribution after debounce delay
      redistributionTimeoutRef.current = window.setTimeout(() => {
        const prefixHeight = prefixElementRef.current?.offsetHeight || 0;
        setDistribution(() => {
          const { distribution: newDistribution } = distributeItemsToColumns(memoList, columns, newItemHeights, prefixHeight);
          return newDistribution;
        });
      }, REDISTRIBUTION_DEBOUNCE_MS);
    },
    [memoList, columns, prefixElementRef],
  );

  /**
   * Handle height changes from individual memo items
   */
  const handleHeightChange = useCallback(
    (memoName: string, height: number) => {
      setItemHeights((prevHeights) => {
        const newItemHeights = new Map(prevHeights);
        const previousHeight = prevHeights.get(memoName);

        // Skip if height hasn't changed (avoid unnecessary updates)
        if (previousHeight === height) {
          return prevHeights;
        }

        newItemHeights.set(memoName, height);

        // Use debounced redistribution to batch updates
        debouncedRedistribute(newItemHeights);

        return newItemHeights;
      });
    },
    [debouncedRedistribute],
  );

  /**
   * Handle window resize and calculate new column count
   */
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;

      const newColumns = calculateColumns();
      if (newColumns !== columns) {
        setColumns(newColumns);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [calculateColumns, columns, containerRef]);

  /**
   * Redistribute memos when columns or memo list change
   */
  useEffect(() => {
    redistributeMemos();
  }, [columns, memoList, redistributeMemos]);

  /**
   * Cleanup timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (redistributionTimeoutRef.current) {
        clearTimeout(redistributionTimeoutRef.current);
      }
    };
  }, []);

  return {
    columns,
    distribution,
    handleHeightChange,
  };
}
