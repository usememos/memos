import { createContext } from "react";

/**
 * Context for MemoContent rendering
 *
 * Provides memo metadata and configuration to child components
 * Used by custom react-markdown components (TaskListItem, Tag, etc.)
 */

export interface MemoContentContextType {
  /** The memo resource name (e.g., "memos/123") */
  memoName?: string;

  /** Whether content is readonly (non-editable) */
  readonly: boolean;

  /** Whether to disable tag/link filtering */
  disableFilter?: boolean;

  /** Parent page path (for navigation) */
  parentPage?: string;

  /** Reference to the container element for the memo content */
  containerRef?: React.RefObject<HTMLDivElement>;
}

export const MemoContentContext = createContext<MemoContentContextType>({
  readonly: true,
  disableFilter: false,
});
