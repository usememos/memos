import type { Memo } from "@/types/proto/api/v1/memo_service";
import type { User } from "@/types/proto/api/v1/user_service";

/**
 * Props for ReactionSelector component
 */
export interface ReactionSelectorProps {
  /** The memo to add reactions to */
  memo: Memo;
  /** Additional CSS classes */
  className?: string;
  /** Callback when popover open state changes */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Props for ReactionView component
 */
export interface ReactionViewProps {
  /** The memo that the reaction belongs to */
  memo: Memo;
  /** The emoji/reaction type */
  reactionType: string;
  /** Users who added this reaction */
  users: User[];
}
