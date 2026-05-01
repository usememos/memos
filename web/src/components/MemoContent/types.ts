import type React from "react";

export interface MemoContentProps {
  content: string;
  compact?: boolean;
  compactMode?: MemoContentCompactMode;
  className?: string;
  contentClassName?: string;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
}

export type ContentCompactView = "ALL" | "SNIPPET";

export interface MemoContentCompactMode {
  containerRef: React.RefObject<HTMLDivElement>;
  mode: ContentCompactView | undefined;
  toggle: () => void;
}
