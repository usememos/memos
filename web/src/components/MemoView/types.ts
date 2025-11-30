import type { Memo } from "@/types/proto/api/v1/memo_service";
import type { User } from "@/types/proto/api/v1/user_service";

export interface MemoViewProps {
  memo: Memo;
  compact?: boolean;
  showCreator?: boolean;
  showVisibility?: boolean;
  showPinned?: boolean;
  showNsfwContent?: boolean;
  className?: string;
  parentPage?: string;
}

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

export interface MemoBodyProps {
  // Display options
  compact?: boolean;
  // Callbacks
  onContentClick: (e: React.MouseEvent) => void;
  onContentDoubleClick: (e: React.MouseEvent) => void;
  onToggleNsfwVisibility: () => void;
}

export interface ImagePreviewState {
  open: boolean;
  urls: string[];
  index: number;
}

export interface UseMemoActionsReturn {
  archiveMemo: () => Promise<void>;
  unpinMemo: () => Promise<void>;
}

export interface UseKeyboardShortcutsOptions {
  enabled: boolean;
  readonly: boolean;
  showEditor: boolean;
  isArchived: boolean;
  onEdit: () => void;
  onArchive: () => Promise<void>;
}

export interface UseNsfwContentReturn {
  nsfw: boolean;
  showNSFWContent: boolean;
  toggleNsfwVisibility: () => void;
}

export interface UseImagePreviewReturn {
  previewState: ImagePreviewState;
  openPreview: (url: string) => void;
  closePreview: () => void;
  setPreviewOpen: (open: boolean) => void;
}
