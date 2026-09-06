import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import type { MemoOriginScope } from "./navigation";

/** How the header names the memo's time: relative to now, or just the clock time for lists that already name the day. */
export type MemoTimeDisplay = "relative" | "time";

export interface MemoViewProps {
  memo: Memo;
  compact?: boolean;
  timeDisplay?: MemoTimeDisplay;
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

export interface MemoViewHandle {
  openEditor: () => void;
}

export interface MemoHeaderProps {
  timeDisplay?: MemoTimeDisplay;
  showCreator?: boolean;
  showVisibility?: boolean;
  showPinned?: boolean;
  showSpace?: boolean;
}

export interface MemoBodyProps {
  compact?: boolean;
}
