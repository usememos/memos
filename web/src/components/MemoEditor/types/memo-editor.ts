import type { Attachment } from "@/types/proto/api/v1/attachment_service";
import type { Location, MemoRelation, Visibility } from "@/types/proto/api/v1/memo_service";

/**
 * Props for the MemoEditor component
 */
export interface MemoEditorProps {
  /** Optional CSS class name */
  className?: string;
  /** Cache key for localStorage persistence */
  cacheKey?: string;
  /** Placeholder text for empty editor */
  placeholder?: string;
  /** Name of the memo being edited (for edit mode) */
  memoName?: string;
  /** Name of parent memo (for comment/reply mode) */
  parentMemoName?: string;
  /** Whether to auto-focus the editor on mount */
  autoFocus?: boolean;
  /** Callback when memo is saved successfully */
  onConfirm?: (memoName: string) => void;
  /** Callback when editing is canceled */
  onCancel?: () => void;
}

/**
 * Internal state for MemoEditor component
 */
export interface MemoEditorState {
  /** Visibility level of the memo */
  memoVisibility: Visibility;
  /** List of attachments */
  attachmentList: Attachment[];
  /** List of related memos */
  relationList: MemoRelation[];
  /** Geographic location */
  location: Location | undefined;
  /** Whether attachments are currently being uploaded */
  isUploadingAttachment: boolean;
  /** Whether save/update request is in progress */
  isRequesting: boolean;
  /** Whether IME composition is active (for Asian languages) */
  isComposing: boolean;
  /** Whether files are being dragged over the editor */
  isDraggingFile: boolean;
  /** Whether Focus Mode is enabled */
  isFocusMode: boolean;
}

/**
 * Configuration for the Editor sub-component
 */
export interface EditorConfig {
  className: string;
  initialContent: string;
  placeholder: string;
  onContentChange: (content: string) => void;
  onPaste: (event: React.ClipboardEvent) => void;
  isFocusMode: boolean;
  isInIME: boolean;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
}
