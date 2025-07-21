import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Memo } from "@/types/proto/api/v1/memo_service";

interface Props {
  memoList: Memo[];
  renderer: (memo: Memo) => JSX.Element;
  prefixElement?: JSX.Element;
  listMode?: boolean;
}

interface MemoItemProps {
  memo: Memo;
  renderer: (memo: Memo) => JSX.Element;
  onHeightChange: (memoName: string, height: number) => void;
}

// Minimum width required to show more than one column
const MINIMUM_MEMO_VIEWPORT_WIDTH = 512;

const MemoItem = ({ memo, renderer, onHeightChange }: MemoItemProps) => {
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

    measureHeight();

    // Set up ResizeObserver to track dynamic content changes (images, expanded text, etc.)
    resizeObserverRef.current = new ResizeObserver(measureHeight);
    resizeObserverRef.current.observe(itemRef.current);

    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [memo.name, onHeightChange]);

  return <div ref={itemRef}>{renderer(memo)}</div>;
};

/**
 * Algorithm to distribute memos into columns based on height for balanced layout
 * Uses greedy approach: always place next memo in the shortest column
 */
const distributeMemosToColumns = (
  memos: Memo[],
  columns: number,
  itemHeights: Map<string, number>,
  prefixElementHeight: number = 0,
): { distribution: number[][]; columnHeights: number[] } => {
  // List mode: all memos in single column
  if (columns === 1) {
    const totalHeight = memos.reduce((sum, memo) => sum + (itemHeights.get(memo.name) || 0), prefixElementHeight);
    return {
      distribution: [Array.from({ length: memos.length }, (_, i) => i)],
      columnHeights: [totalHeight],
    };
  }

  // Initialize columns and heights
  const distribution: number[][] = Array.from({ length: columns }, () => []);
  const columnHeights: number[] = Array(columns).fill(0);

  // Add prefix element height to first column
  if (prefixElementHeight > 0) {
    columnHeights[0] = prefixElementHeight;
  }

  // Distribute each memo to the shortest column
  memos.forEach((memo, index) => {
    const height = itemHeights.get(memo.name) || 0;

    // Find column with minimum height
    const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));

    distribution[shortestColumnIndex].push(index);
    columnHeights[shortestColumnIndex] += height;
  });

  return { distribution, columnHeights };
};

const MasonryView = (props: Props) => {
  const [columns, setColumns] = useState(1);
  const [itemHeights, setItemHeights] = useState<Map<string, number>>(new Map());
  const [distribution, setDistribution] = useState<number[][]>([[]]);

  const containerRef = useRef<HTMLDivElement>(null);
  const prefixElementRef = useRef<HTMLDivElement>(null);

  // Calculate optimal number of columns based on container width
  const calculateColumns = useCallback(() => {
    if (!containerRef.current || props.listMode) return 1;

    const containerWidth = containerRef.current.offsetWidth;
    const scale = containerWidth / MINIMUM_MEMO_VIEWPORT_WIDTH;
    return scale >= 2 ? Math.round(scale) : 1;
  }, [props.listMode]);

  // Recalculate memo distribution when layout changes
  const redistributeMemos = useCallback(() => {
    const prefixHeight = prefixElementRef.current?.offsetHeight || 0;
    const { distribution: newDistribution } = distributeMemosToColumns(props.memoList, columns, itemHeights, prefixHeight);
    setDistribution(newDistribution);
  }, [props.memoList, columns, itemHeights]);

  // Handle height changes from individual memo items
  const handleHeightChange = useCallback(
    (memoName: string, height: number) => {
      setItemHeights((prevHeights) => {
        const newItemHeights = new Map(prevHeights);
        newItemHeights.set(memoName, height);

        // Recalculate distribution with new heights
        const prefixHeight = prefixElementRef.current?.offsetHeight || 0;
        const { distribution: newDistribution } = distributeMemosToColumns(props.memoList, columns, newItemHeights, prefixHeight);
        setDistribution(newDistribution);

        return newItemHeights;
      });
    },
    [props.memoList, columns],
  );

  // Handle window resize and calculate new column count
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
  }, [calculateColumns, columns]);

  // Redistribute memos when columns, memo list, or heights change
  useEffect(() => {
    redistributeMemos();
  }, [redistributeMemos]);

  return (
    <div
      ref={containerRef}
      className={cn("w-full grid gap-2")}
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
      }}
    >
      {Array.from({ length: columns }).map((_, columnIndex) => (
        <div key={columnIndex} className="min-w-0 mx-auto w-full max-w-2xl">
          {/* Prefix element (like memo editor) goes in first column */}
          {props.prefixElement && columnIndex === 0 && <div ref={prefixElementRef}>{props.prefixElement}</div>}

          {distribution[columnIndex]?.map((memoIndex) => {
            const memo = props.memoList[memoIndex];
            return memo ? (
              <MemoItem
                key={`${memo.name}-${memo.displayTime}`}
                memo={memo}
                renderer={props.renderer}
                onHeightChange={handleHeightChange}
              />
            ) : null;
          })}
        </div>
      ))}
    </div>
  );
};

export default MasonryView;
