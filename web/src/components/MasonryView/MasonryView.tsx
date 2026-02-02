import { useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { MasonryColumn } from "./MasonryColumn";
import { MasonryViewProps, MemoRenderContext } from "./types";
import { useMasonryLayout } from "./useMasonryLayout";

const MasonryView = ({ memoList, renderer, prefixElement, listMode = false }: MasonryViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefixElementRef = useRef<HTMLDivElement>(null);

  const { columns, distribution, handleHeightChange } = useMasonryLayout(memoList, listMode, containerRef, prefixElementRef);

  // Create render context: always enable compact mode for list views
  const renderContext: MemoRenderContext = useMemo(
    () => ({
      compact: true,
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
