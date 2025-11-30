import { createContext, useContext } from "react";
import type { Memo } from "@/types/proto/api/v1/memo_service";
import type { User } from "@/types/proto/api/v1/user_service";

/**
 * Context value for MemoView component tree
 * Provides shared state and props to child components
 */
export interface MemoViewContextValue {
  /** The memo data */
  memo: Memo;
  /** The memo creator user data */
  creator: User | undefined;
  /** Whether the memo is in archived state */
  isArchived: boolean;
  /** Whether the current user can only view (not edit) the memo */
  readonly: boolean;
  /** Whether we're currently on the memo detail page */
  isInMemoDetailPage: boolean;
  /** Parent page path for navigation state */
  parentPage: string;
  /** Number of comments on this memo */
  commentAmount: number;
  /** Time format to use (datetime for old memos, auto for recent) */
  relativeTimeFormat: "datetime" | "auto";
  /** Whether this memo contains NSFW content */
  nsfw: boolean;
  /** Whether to show NSFW content without blur */
  showNSFWContent: boolean;
}

/**
 * Context for sharing MemoView state across child components
 * This eliminates prop drilling for commonly used values
 */
export const MemoViewContext = createContext<MemoViewContextValue | null>(null);

/**
 * Hook to access MemoView context
 * @throws Error if used outside of MemoViewContext.Provider
 */
export const useMemoViewContext = (): MemoViewContextValue => {
  const context = useContext(MemoViewContext);
  if (!context) {
    throw new Error("useMemoViewContext must be used within MemoViewContext.Provider");
  }
  return context;
};
