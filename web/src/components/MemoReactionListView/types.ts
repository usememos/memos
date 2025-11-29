import type { Memo, Reaction } from "@/types/proto/api/v1/memo_service";
import type { User } from "@/types/proto/api/v1/user_service";

/**
 * Props for MemoReactionListView component
 */
export interface MemoReactionListViewProps {
  /** The memo that reactions belong to */
  memo: Memo;
  /** List of reactions to display */
  reactions: Reaction[];
}

/**
 * Grouped reactions with users who reacted
 */
export type ReactionGroup = Map<string, User[]>;
