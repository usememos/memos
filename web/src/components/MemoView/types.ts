import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

export interface MemoViewProps {
  memo: Memo;
  compact?: boolean;
  showCreator?: boolean;
  showVisibility?: boolean;
  showPinned?: boolean;
  className?: string;
  parentPage?: string;
<<<<<<< HEAD
  colorKey?: string;
}

export interface MemoHeaderProps {
  name:string;
  showCreator?: boolean;
  showVisibility?: boolean;
  showPinned?: boolean;
  onColorPreferencesChange?: (colors: { bgColor: string; textColor: string }) => void;
  showColorCustomizer?: boolean;
=======
}

export interface MemoHeaderProps {
  showCreator?: boolean;
  showVisibility?: boolean;
  showPinned?: boolean;
>>>>>>> 89d43a2e (Developed Color Picker Feature for memos)
}

export interface MemoBodyProps {
  compact?: boolean;
}
