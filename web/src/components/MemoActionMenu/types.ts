import type { Memo } from "@/types/proto/api/v1/memo_service";

/**
 * Props for MemoActionMenu component
 */
export interface MemoActionMenuProps {
  /** The memo to display actions for */
  memo: Memo;
  /** Whether the current user can only view (not edit) */
  readonly?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when edit action is triggered */
  onEdit?: () => void;
}

/**
 * Return type for useMemoActionHandlers hook
 */
export interface UseMemoActionHandlersReturn {
  handleTogglePinMemoBtnClick: () => Promise<void>;
  handleEditMemoClick: () => void;
  handleToggleMemoStatusClick: () => Promise<void>;
  handleCopyLink: () => void;
  handleCopyContent: () => void;
  handleDeleteMemoClick: () => void;
  confirmDeleteMemo: () => Promise<void>;
  handleRemoveCompletedTaskListItemsClick: () => void;
  confirmRemoveCompletedTaskListItems: () => Promise<void>;
}
