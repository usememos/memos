import type React from "react";
import type { Attachment } from "@/types/proto/api/attachment_service_pb";

export interface MemoContentProps {
  content: string;
  /** Attachments bound to this memo, used to resolve managed image URLs in share/S3 modes. */
  attachments?: Attachment[];
  /** Resource name of the memo (e.g. `memos/abc123`). Lets in-memo anchor links open the memo detail page. */
  memoName?: string;
  /** Collection page that rendered the memo, preserved when an inline link opens its detail page. */
  parentPage?: string;
  /** The card renders collapsed (ClampedSection), so in-memo anchor links navigate instead of scrolling. */
  compact?: boolean;
  /**
   * Lets the viewer tick task items, for a memo they can manage. Called with the new
   * Markdown, in which only the ticked item's `[ ]` or `[x]` changed.
   */
  onTaskToggle?: (content: string) => void;
  className?: string;
  contentClassName?: string;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
}
