import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

/**
 * Props for the MemoView component.
 * MemoView is the main component for displaying a memo card with all its metadata,
 * content, and interactive elements.
 */
export interface MemoViewProps {
  /** The memo object to display */
  memo: Memo;
  /** Whether to show compact view (hides some metadata) */
  compact?: boolean;
  /** Whether to show the creator's profile information */
  showCreator?: boolean;
  /** Whether to show the visibility indicator */
  showVisibility?: boolean;
  /** Whether to show the pinned indicator */
  showPinned?: boolean;
  /** Whether to show NSFW content by default */
  showNsfwContent?: boolean;
  /** Additional CSS classes to apply to the root element */
  className?: string;
  /** The parent page URL for navigation context */
  parentPage?: string;
}

/**
 * Props for the MemoHeader component.
 * Displays memo metadata like creator, timestamp, and action buttons.
 */
export interface MemoHeaderProps {
  // Display options
  showCreator?: boolean;
  showVisibility?: boolean;
  showPinned?: boolean;
  // Callbacks
  onEdit: () => void;
  onGotoDetail: () => void;
  onUnpin: () => void;
  onToggleNsfwVisibility?: () => void;
  // Reaction state
  reactionSelectorOpen: boolean;
  onReactionSelectorOpenChange: (open: boolean) => void;
}

/**
 * Props for the MemoBody component.
 * Displays memo content, attachments, and relations.
 */
export interface MemoBodyProps {
  // Display options
  compact?: boolean;
  // Callbacks
  onContentClick: (e: React.MouseEvent) => void;
  onContentDoubleClick: (e: React.MouseEvent) => void;
  onToggleNsfwVisibility: () => void;
}
