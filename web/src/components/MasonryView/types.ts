import { Memo } from "@/types/proto/api/v1/memo_service_pb";

export interface MemoRenderContext {
  compact: boolean;
  columns: number;
}

export interface MasonryViewProps {
  memoList: Memo[];
  renderer: (memo: Memo, context?: MemoRenderContext) => JSX.Element;
  prefixElement?: JSX.Element;
  listMode?: boolean;
}

export interface MasonryItemProps {
  memo: Memo;
  renderer: (memo: Memo, context?: MemoRenderContext) => JSX.Element;
  renderContext: MemoRenderContext;
  onHeightChange: (memoName: string, height: number) => void;
}

export interface MasonryColumnProps {
  memoIndices: number[];
  memoList: Memo[];
  renderer: (memo: Memo, context?: MemoRenderContext) => JSX.Element;
  renderContext: MemoRenderContext;
  onHeightChange: (memoName: string, height: number) => void;
  isFirstColumn: boolean;
  prefixElement?: JSX.Element;
  prefixElementRef?: React.RefObject<HTMLDivElement>;
}

export interface DistributionResult {
  distribution: number[][];
  columnHeights: number[];
}

export interface MemoWithHeight {
  index: number;
  height: number;
}
