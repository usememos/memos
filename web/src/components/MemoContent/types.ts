import type React from "react";

export interface MemoContentProps {
  content: string;
  memoName?: string;
  compact?: boolean;
  readonly?: boolean;
  disableFilter?: boolean;
  className?: string;
  contentClassName?: string;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  parentPage?: string;
}

export type ContentCompactView = "ALL" | "SNIPPET";
