import type React from "react";

export interface MemoContentProps {
  content: string;
  /** Resource name of the memo (e.g. `memos/abc123`). Enables footnote links to target the memo detail page. */
  memoName?: string;
  compact?: boolean;
  className?: string;
  contentClassName?: string;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
}

export type ContentCompactView = "ALL" | "SNIPPET";
