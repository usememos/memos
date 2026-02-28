import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

export interface MemoViewProps {
  memo: Memo;
  compact?: boolean;
  showCreator?: boolean;
  showVisibility?: boolean;
  showPinned?: boolean;
  className?: string;
  parentPage?: string;
}

export interface MemoHeaderProps {
  showCreator?: boolean;
  showVisibility?: boolean;
  showPinned?: boolean;
  onEdit: () => void;
  onGotoDetail: () => void;
  onUnpin: () => void;
}

export interface MemoBodyProps {
  compact?: boolean;
  onContentClick: (e: React.MouseEvent) => void;
  onContentDoubleClick: (e: React.MouseEvent) => void;
  onToggleNsfwVisibility: () => void;
}
