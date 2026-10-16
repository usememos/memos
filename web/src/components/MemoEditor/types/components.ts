import type { MemoSuggestion } from "@/lib/memo-suggestions";
import type { Attachment } from "@/types/proto/api/attachment_service_pb";
import type { Location, Memo, Visibility } from "@/types/proto/api/memo_service_pb";
import type { UserSetting_TagsSetting } from "@/types/proto/api/user_service_pb";
import type { EditorFileOrigin } from "../Editor/extensions";
import type { AudioRecorderStatus } from "../hooks/useAudioRecorder";
import type { LocalFile } from "./attachment";

export interface MemoEditorProps {
  className?: string;
  cacheKey?: string;
  placeholder?: string;
  /** Existing memo to edit. When provided, the editor initializes from it without fetching. */
  memo?: Memo;
  parentMemoName?: string;
  /** Context-derived suggestions for a new top-level memo. */
  suggestions?: readonly MemoSuggestion[];
  /** Assigns a newly created top-level memo to this Space. Ignored for edits and comments. */
  defaultSpace?: string;
  /** Seeds a new memo once; restored draft metadata takes precedence. */
  defaultLocation?: Location;
  /** A callback can decide whether focus is still appropriate after draft restoration. */
  autoFocus?: boolean | (() => boolean);
  /**
   * Marks the instance as *hosted*: a host (the global composer dialog) presents
   * the editor in the focus-mode layout and owns that frame. The editor mounts
   * straight into focus mode, drops the view toggles that only make sense inline,
   * and exits by calling this to dismiss the host rather than collapsing in place.
   */
  onFocusModeExit?: () => void;
  /**
   * Reports inline focus-mode changes. A host reacts to the editor taking over
   * the viewport, e.g. the memo grid untraps its tile so the fixed focus-mode
   * surface is not contained by a transformed ancestor.
   */
  onFocusModeChange?: (isFocusMode: boolean) => void;
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
  sourceMode: EditorSourceModeToggle;
  /** Invoked by the in-editor save shortcut (Cmd/Ctrl+Enter). */
  onSubmit: () => void;
  onFiles: (files: File[], origin: EditorFileOrigin) => void;
  /** The user's tag settings, for tags in their custom colors. */
  tagsSetting?: UserSetting_TagsSetting;
}

/**
 * The ＋ menu's view toggles. They change how the editor presents itself
 * inline, so a hosted editor omits the whole group.
 */
export interface EditorViewToggles {
  onToggleFocusMode: () => void;
}

/** The composer's source-mode switch: an item in the ＋ menu, and a tag in the editor's corner while on. */
export interface EditorSourceModeToggle {
  isSourceMode: boolean;
  onToggle: () => void;
}

export interface EditorToolbarProps {
  onSave: () => void;
  onCancel?: () => void;
  memoName?: string;
  /** Set when the editor composes a comment on this memo; picks the commit verb. */
  parentMemoName?: string;
  /** The Space that owns the memo being created or edited, if any. */
  space?: string;
  /** Only unscoped, new top-level memos can choose a destination. */
  canChooseSpace?: boolean;
  onAudioRecorderClick: () => void;
  viewToggles?: EditorViewToggles;
  sourceMode: EditorSourceModeToggle;
  onInsertImages: (files: File[]) => void;
}

export interface EditorMetadataProps {
  onTranscribeAttachment?: (attachment: Attachment) => void;
  transcribingAttachment?: string;
  transcriptionDisabled?: boolean;
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
  /** "minimize" collapses inline focus mode back into the page; "close" dismisses a host-owned frame. */
  action: "minimize" | "close";
  onExit: () => void;
}

export interface InsertMenuProps {
  isUploading?: boolean;
  isSaving?: boolean;
  location?: Location;
  onLocationChange: (location?: Location) => void;
  memoName?: string;
  onAudioRecorderClick?: () => void;
  viewToggles?: EditorViewToggles;
  sourceMode: EditorSourceModeToggle;
  onInsertImages: (files: File[]) => void;
}

export interface AudienceMenuProps {
  value: Visibility;
  onChange: (visibility: Visibility) => void;
  /** The memo's actual placement; independent of the ambient collection scope. */
  space?: string;
  onSpaceChange?: (space?: string) => void;
  disabled?: boolean;
}
