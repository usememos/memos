import { MasonryItem } from "./MasonryItem";
import { MasonryColumnProps } from "./types";

export function MasonryColumn({
  memoIndices,
  memoList,
  renderer,
  renderContext,
  onHeightChange,
  isFirstColumn,
  prefixElement,
  prefixElementRef,
}: MasonryColumnProps) {
  return (
    <div className="min-w-0 mx-auto w-full max-w-2xl">
      {/* Prefix element (like memo editor) goes in first column */}
      {isFirstColumn && prefixElement && <div ref={prefixElementRef}>{prefixElement}</div>}

      {/* Render all memos assigned to this column */}
      {memoIndices?.map((memoIndex) => {
        const memo = memoList[memoIndex];
        return memo ? (
          <MasonryItem
            key={`${memo.name}-${memo.displayTime}`}
            memo={memo}
            renderer={renderer}
            renderContext={renderContext}
            onHeightChange={onHeightChange}
          />
        ) : null;
      })}
    </div>
  );
}
