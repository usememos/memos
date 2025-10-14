import { Memo } from "@/types/proto/api/v1/memo_service";

/**
 * Render context passed to memo renderer
 */
export interface MemoRenderContext {
  /** Whether to render in compact mode (automatically enabled for multi-column layouts) */
  compact: boolean;
  /** Current number of columns in the layout */
  columns: number;
}

/**
 * Props for the main MasonryView component
 */
export interface MasonryViewProps {
  /** List of memos to display in masonry layout */
  memoList: Memo[];
  /** Render function for each memo. Second parameter provides layout context. */
  renderer: (memo: Memo, context?: MemoRenderContext) => JSX.Element;
  /** Optional element to display at the top of the first column (e.g., memo editor) */
  prefixElement?: JSX.Element;
  /** Force single column layout regardless of viewport width */
  listMode?: boolean;
}

/**
 * Props for individual MasonryItem component
 */
export interface MasonryItemProps {
  /** The memo to render */
  memo: Memo;
  /** Render function for the memo */
  renderer: (memo: Memo, context?: MemoRenderContext) => JSX.Element;
  /** Render context for the memo */
  renderContext: MemoRenderContext;
  /** Callback when item height changes */
  onHeightChange: (memoName: string, height: number) => void;
}

/**
 * Props for MasonryColumn component
 */
export interface MasonryColumnProps {
  /** Indices of memos in this column */
  memoIndices: number[];
  /** Full list of memos */
  memoList: Memo[];
  /** Render function for each memo */
  renderer: (memo: Memo, context?: MemoRenderContext) => JSX.Element;
  /** Render context for memos */
  renderContext: MemoRenderContext;
  /** Callback when item height changes */
  onHeightChange: (memoName: string, height: number) => void;
  /** Whether this is the first column (for prefix element) */
  isFirstColumn: boolean;
  /** Optional prefix element (only rendered in first column) */
  prefixElement?: JSX.Element;
  /** Ref for prefix element height measurement */
  prefixElementRef?: React.RefObject<HTMLDivElement>;
}

/**
 * Result of the distribution algorithm
 */
export interface DistributionResult {
  /** Array of arrays, where each inner array contains memo indices for that column */
  distribution: number[][];
  /** Height of each column after distribution */
  columnHeights: number[];
}

/**
 * Memo item with measured height
 */
export interface MemoWithHeight {
  /** Index of the memo in the original list */
  index: number;
  /** Measured height in pixels */
  height: number;
}
