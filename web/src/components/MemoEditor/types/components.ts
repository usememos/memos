import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import type { Location, Memo, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import type { AudioRecorderStatus } from "../hooks/useAudioRecorder";
import type { LocalFile } from "./attachment";

export interface MemoEditorProps {
  className?: string;
  cacheKey?: string;
  placeholder?: string;
  /** Existing memo to edit. When provided, the editor initializes from it without fetching. */
  memo?: Memo;
  parentMemoName?: string;
  /** Assigns a newly created top-level memo to this Space. Ignored for edits and comments. */
  defaultSpace?: string;
  autoFocus?: boolean;
  /**
   * Marks the instance as *hosted*: a host (the global composer dialog) presents
   * the editor in the focus-mode layout and owns that frame. The editor mounts
   * straight into focus mode, drops the view toggles that only make sense inline,
   * and exits by calling this to dismiss the host rather than collapsing in place.
   */
  onFocusModeExit?: () => void;
  /**
   * Default `createTime` for a *new* memo (create mode only). When set, the
   * editor seeds both `createTime` and `updateTime` to this value and renders
   * the timestamp popover so the user can adjust before saving. Tracked live:
   * if the prop changes after mount, the editor's timestamps re-sync. Ignored
   * in edit mode (when `memo` is set).
   */
  defaultCreateTime?: Date;
  onConfirm?: (memoName: string) => void;
  onCancel?: () => void;
  /** Reports save activity so external presentations can prevent dismissal mid-transaction. */
  onSavingChange?: (isSaving: boolean) => void;
}

export interface EditorContentProps {
  placeholder?: string;
  /** Invoked by the in-editor save shortcut (Cmd/Ctrl+Enter). */
  onSubmit: () => void;
  onFiles: (files: File[], position: number) => void;
}

/**
 * The ＋ menu's view toggles. They change how the editor presents itself
 * inline, so a hosted editor omits the whole group and both items disappear
 * together — there is no way to offer one without the other.
 */
export interface EditorViewToggles {
  onToggleFocusMode: () => void;
  /** Whether the formatting toolbar is shown in normal mode (persisted preference). */
  isFormattingToolbarVisible: boolean;
  onToggleFormattingToolbar: () => void;
}

export interface EditorToolbarProps {
  onSave: () => void;
  onCancel?: () => void;
  memoName?: string;
  onAudioRecorderClick: () => void;
  viewToggles?: EditorViewToggles;
  onInsertImages: (files: File[]) => void;
}

export interface EditorMetadataProps {
  memoName?: string;
  uploadingLocalFileURLs: ReadonlySet<string>;
  onInsertAttachments: (attachments: Attachment[]) => void;
  onInsertLocalFiles: (localFiles: LocalFile[]) => void;
}

export interface AudioRecorderPanelProps {
  audioRecorder: { status: AudioRecorderStatus; elapsedSeconds: number };
  /** Active mic stream while recording; used for live waveform visualization. */
  mediaStream: MediaStream | null;
  onStop: () => void;
  onCancel: () => void;
  onTranscribe?: () => void;
  canTranscribe?: boolean;
  isTranscribing?: boolean;
}

export interface FocusModeOverlayProps {
  isActive: boolean;
  onToggle: () => void;
}

export interface FocusModeExitButtonProps {
  isActive: boolean;
  onToggle: () => void;
  title: string;
}

export interface InsertMenuProps {
  isUploading?: boolean;
  isSaving?: boolean;
  location?: Location;
  onLocationChange: (location?: Location) => void;
  memoName?: string;
  onAudioRecorderClick?: () => void;
  viewToggles?: EditorViewToggles;
  onInsertImages: (files: File[]) => void;
}

export interface VisibilitySelectorProps {
  value: Visibility;
  onChange: (visibility: Visibility) => void;
  onOpenChange?: (open: boolean) => void;
  /** "compact" renders a 13px trigger that blends into dense surfaces like the memo detail rail. */
  size?: "default" | "compact";
}
