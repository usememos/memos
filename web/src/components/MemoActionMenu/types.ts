import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

export interface MemoActionMenuProps {
  memo: Memo;
  readonly?: boolean;
  className?: string;
  onEdit?: () => void;
}

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
