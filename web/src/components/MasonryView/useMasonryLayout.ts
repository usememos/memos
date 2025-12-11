import { useCallback, useEffect, useRef, useState } from "react";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { MINIMUM_MEMO_VIEWPORT_WIDTH, REDISTRIBUTION_DEBOUNCE_MS } from "./constants";
import { distributeItemsToColumns } from "./distributeItems";

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

  useEffect(() => {
    itemHeightsRef.current = itemHeights;
  }, [itemHeights]);

  const calculateColumns = useCallback(() => {
    if (!containerRef.current || listMode) return 1;

    const containerWidth = containerRef.current.offsetWidth;
    const scale = containerWidth / MINIMUM_MEMO_VIEWPORT_WIDTH;
    return scale >= 1.2 ? Math.ceil(scale) : 1;
  }, [containerRef, listMode]);

  const redistributeMemos = useCallback(() => {
    const prefixHeight = prefixElementRef.current?.offsetHeight || 0;
    setDistribution(() => {
      const { distribution: newDistribution } = distributeItemsToColumns(memoList, columns, itemHeightsRef.current, prefixHeight);
      return newDistribution;
    });
  }, [memoList, columns, prefixElementRef]);

  const debouncedRedistribute = useCallback(
    (newItemHeights: Map<string, number>) => {
      if (redistributionTimeoutRef.current) {
        clearTimeout(redistributionTimeoutRef.current);
      }

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

  const handleHeightChange = useCallback(
    (memoName: string, height: number) => {
      setItemHeights((prevHeights) => {
        const newItemHeights = new Map(prevHeights);
        const previousHeight = prevHeights.get(memoName);

        if (previousHeight === height) {
          return prevHeights;
        }

        newItemHeights.set(memoName, height);
        debouncedRedistribute(newItemHeights);
        return newItemHeights;
      });
    },
    [debouncedRedistribute],
  );

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

  useEffect(() => {
    redistributeMemos();
  }, [columns, memoList, redistributeMemos]);

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
