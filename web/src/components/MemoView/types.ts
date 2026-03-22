import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

export interface MemoViewProps {
  memo: Memo;
  compact?: boolean;
  showCreator?: boolean;
  showVisibility?: boolean;
  showPinned?: boolean;
  className?: string;
  parentPage?: string;
  colorKey?: string;
}

export interface MemoHeaderProps {
  name:string;
  showCreator?: boolean;
  showVisibility?: boolean;
  showPinned?: boolean;
  onColorPreferencesChange?: (colors: { bgColor: string; textColor: string }) => void;
  showColorCustomizer?: boolean;
}

export interface MemoBodyProps {
  compact?: boolean;
}
