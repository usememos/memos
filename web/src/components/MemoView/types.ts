import type { Memo } from "@/types/proto/api/v1/memo_service";
import type { User } from "@/types/proto/api/v1/user_service";

/**
 * Props for the MemoView component
 */
export interface MemoViewProps {
  /** The memo data to display */
  memo: Memo;
  /** Enable compact mode with truncated content */
  compact?: boolean;
  /** Show creator avatar and name */
  showCreator?: boolean;
  /** Show visibility icon */
  showVisibility?: boolean;
  /** Show pinned indicator */
  showPinned?: boolean;
  /** Show NSFW content without blur */
  showNsfwContent?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Parent page path for navigation state */
  parentPage?: string;
}

/**
 * Props for the MemoHeader component
 */
export interface MemoHeaderProps {
  memo: Memo;
  creator: User | undefined;
  showCreator?: boolean;
  showVisibility?: boolean;
  showPinned?: boolean;
  isArchived: boolean;
  commentAmount: number;
  isInMemoDetailPage: boolean;
  parentPage: string;
  readonly: boolean;
  relativeTimeFormat: "datetime" | "auto";
  onEdit: () => void;
  onGotoDetail: () => void;
  onUnpin: () => void;
  onToggleNsfwVisibility?: () => void;
  nsfw?: boolean;
  showNSFWContent?: boolean;
  reactionSelectorOpen: boolean;
  onReactionSelectorOpenChange: (open: boolean) => void;
}

/**
 * Props for the MemoBody component
 */
export interface MemoBodyProps {
  memo: Memo;
  readonly: boolean;
  compact?: boolean;
  parentPage: string;
  nsfw: boolean;
  showNSFWContent: boolean;
  onContentClick: (e: React.MouseEvent) => void;
  onContentDoubleClick: (e: React.MouseEvent) => void;
  onToggleNsfwVisibility: () => void;
}

/**
 * State for image preview dialog
 */
export interface ImagePreviewState {
  open: boolean;
  urls: string[];
  index: number;
}

/**
 * Return type for useMemoActions hook
 */
export interface UseMemoActionsReturn {
  archiveMemo: () => Promise<void>;
  unpinMemo: () => Promise<void>;
}

/**
 * Return type for useKeyboardShortcuts hook
 */
export interface UseKeyboardShortcutsOptions {
  enabled: boolean;
  readonly: boolean;
  showEditor: boolean;
  isArchived: boolean;
  onEdit: () => void;
  onArchive: () => Promise<void>;
}

/**
 * Return type for useNsfwContent hook
 */
export interface UseNsfwContentReturn {
  nsfw: boolean;
  showNSFWContent: boolean;
  toggleNsfwVisibility: () => void;
}

/**
 * Return type for useImagePreview hook
 */
export interface UseImagePreviewReturn {
  previewState: ImagePreviewState;
  openPreview: (url: string) => void;
  closePreview: () => void;
  setPreviewOpen: (open: boolean) => void;
}
