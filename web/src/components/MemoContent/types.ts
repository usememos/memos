import type React from "react";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";

export interface MemoContentProps {
  content: string;
  /** Attachments bound to this memo, used to resolve managed image URLs in share/S3 modes. */
  attachments?: Attachment[];
  /** Resource name of the memo (e.g. `memos/abc123`). Enables footnote links to target the memo detail page. */
  memoName?: string;
  /** The card renders collapsed (ClampedSection), so footnote links navigate instead of scrolling. */
  compact?: boolean;
  className?: string;
  contentClassName?: string;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
}
