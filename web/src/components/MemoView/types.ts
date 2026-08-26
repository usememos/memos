import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import type { MemoOriginScope } from "./navigation";

export interface MemoViewProps {
  memo: Memo;
  compact?: boolean;
  showCreator?: boolean;
  showVisibility?: boolean;
  showPinned?: boolean;
  showSpace?: boolean;
  className?: string;
  parentPage?: string;
  parentScope?: MemoOriginScope;
  shareImageDialogOpen?: boolean;
  onShareImageDialogOpenChange?: (open: boolean) => void;
}

export interface MemoHeaderProps {
  showCreator?: boolean;
  showVisibility?: boolean;
  showPinned?: boolean;
  showSpace?: boolean;
}

export interface MemoBodyProps {
  compact?: boolean;
}
