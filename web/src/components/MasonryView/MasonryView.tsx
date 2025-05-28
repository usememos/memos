import { useCallback, useEffect, useRef, useState } from "react";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { cn } from "@/utils";

interface Props {
  memoList: Memo[];
  renderer: (memo: Memo) => JSX.Element;
  prefixElement?: JSX.Element;
  listMode?: boolean;
}

interface LocalState {
  columns: number;
  itemHeights: Map<string, number>;
  columnHeights: number[];
  distribution: number[][];
}

interface MemoItemProps {
  memo: Memo;
  renderer: (memo: Memo) => JSX.Element;
  onHeightChange: (memoName: string, height: number) => void;
}

const MINIMUM_MEMO_VIEWPORT_WIDTH = 512;

// Component to wrap each memo and measure its height
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

    // Initial measurement
    measureHeight();

    // Set up ResizeObserver for dynamic content changes
    resizeObserverRef.current = new ResizeObserver(() => {
      measureHeight();
    });

    resizeObserverRef.current.observe(itemRef.current);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [memo.name, onHeightChange]);

  return <div ref={itemRef}>{renderer(memo)}</div>;
};

// Algorithm to distribute memos into columns based on height
const distributeMemosToColumns = (
  memos: Memo[],
  columns: number,
  itemHeights: Map<string, number>,
  prefixElementHeight: number = 0,
): { distribution: number[][]; columnHeights: number[] } => {
  if (columns === 1) {
    // List mode - all memos in single column
    return {
      distribution: [Array.from(Array(memos.length).keys())],
      columnHeights: [memos.reduce((sum, memo) => sum + (itemHeights.get(memo.name) || 0), prefixElementHeight)],
    };
  }

  const distribution: number[][] = Array.from({ length: columns }, () => []);
  const columnHeights: number[] = Array(columns).fill(0);

  // Add prefix element height to first column
  if (prefixElementHeight > 0) {
    columnHeights[0] = prefixElementHeight;
  }

  // Distribute memos to the shortest column each time
  memos.forEach((memo, index) => {
    const height = itemHeights.get(memo.name) || 0;

    // Find the shortest column
    const shortestColumnIndex = columnHeights.reduce(
      (minIndex, currentHeight, currentIndex) => (currentHeight < columnHeights[minIndex] ? currentIndex : minIndex),
      0,
    );

    distribution[shortestColumnIndex].push(index);
    columnHeights[shortestColumnIndex] += height;
  });

  return { distribution, columnHeights };
};

const MasonryView = (props: Props) => {
  const [state, setState] = useState<LocalState>({
    columns: 1,
    itemHeights: new Map(),
    columnHeights: [0],
    distribution: [[]],
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const prefixElementRef = useRef<HTMLDivElement>(null);

  // Handle height changes from individual memo items
  const handleHeightChange = useCallback(
    (memoName: string, height: number) => {
      setState((prevState) => {
        const newItemHeights = new Map(prevState.itemHeights);
        newItemHeights.set(memoName, height);

        const prefixHeight = prefixElementRef.current?.offsetHeight || 0;
        const { distribution, columnHeights } = distributeMemosToColumns(props.memoList, prevState.columns, newItemHeights, prefixHeight);

        return {
          ...prevState,
          itemHeights: newItemHeights,
          distribution,
          columnHeights,
        };
      });
    },
    [props.memoList],
  );

  // Handle window resize and column count changes
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) {
        return;
      }

      const newColumns = props.listMode
        ? 1
        : (() => {
            const containerWidth = containerRef.current!.offsetWidth;
            const scale = containerWidth / MINIMUM_MEMO_VIEWPORT_WIDTH;
            return scale >= 2 ? Math.round(scale) : 1;
          })();

      if (newColumns !== state.columns) {
        const prefixHeight = prefixElementRef.current?.offsetHeight || 0;
        const { distribution, columnHeights } = distributeMemosToColumns(props.memoList, newColumns, state.itemHeights, prefixHeight);

        setState((prevState) => ({
          ...prevState,
          columns: newColumns,
          distribution,
          columnHeights,
        }));
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [props.listMode, state.columns, state.itemHeights, props.memoList]);

  // Redistribute when memo list changes
  useEffect(() => {
    const prefixHeight = prefixElementRef.current?.offsetHeight || 0;
    const { distribution, columnHeights } = distributeMemosToColumns(props.memoList, state.columns, state.itemHeights, prefixHeight);

    setState((prevState) => ({
      ...prevState,
      distribution,
      columnHeights,
    }));
  }, [props.memoList, state.columns, state.itemHeights]);

  return (
    <div
      ref={containerRef}
      className={cn("w-full grid gap-2")}
      style={{
        gridTemplateColumns: `repeat(${state.columns}, 1fr)`,
      }}
    >
      {Array.from({ length: state.columns }).map((_, columnIndex) => (
        <div key={columnIndex} className="min-w-0 mx-auto w-full max-w-2xl">
          {props.prefixElement && columnIndex === 0 && (
            <div ref={prefixElementRef} className="mb-2">
              {props.prefixElement}
            </div>
          )}
          {state.distribution[columnIndex]?.map((memoIndex) => {
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
