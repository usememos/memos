import type { Location, Memo, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import type { EditorRefActions } from "../Editor";
import type { Command } from "../Editor/commands";
import type { EditorState } from "../state";

export interface MemoEditorProps {
  className?: string;
  cacheKey?: string;
  placeholder?: string;
  /** Existing memo to edit. When provided, the editor initializes from it without fetching. */
  memo?: Memo;
  parentMemoName?: string;
  autoFocus?: boolean;
  onConfirm?: (memoName: string) => void;
  onCancel?: () => void;
}

export interface EditorContentProps {
  placeholder?: string;
}

export interface EditorToolbarProps {
  onSave: () => void;
  onCancel?: () => void;
  memoName?: string;
  onVoiceRecorderClick: () => void;
}

export interface EditorMetadataProps {
  memoName?: string;
}

export interface VoiceRecorderPanelProps {
  voiceRecorder: EditorState["voiceRecorder"];
  onStart: () => void;
  onStop: () => void;
  onKeep: () => void;
  onDiscard: () => void;
  onRecordAgain: () => void;
  onClose: () => void;
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
  location?: Location;
  onLocationChange: (location?: Location) => void;
  onToggleFocusMode?: () => void;
  memoName?: string;
  onVoiceRecorderClick?: () => void;
}

export interface TagSuggestionsProps {
  editorRef: React.RefObject<HTMLTextAreaElement>;
  editorActions: React.ForwardedRef<EditorRefActions>;
}

export interface SlashCommandsProps {
  editorRef: React.RefObject<HTMLTextAreaElement>;
  editorActions: React.ForwardedRef<EditorRefActions>;
  commands: Command[];
}

export interface EditorProps {
  className: string;
  initialContent: string;
  placeholder: string;
  onContentChange: (content: string) => void;
  onPaste: (event: React.ClipboardEvent) => void;
  isFocusMode?: boolean;
  isInIME?: boolean;
  onCompositionStart?: () => void;
  onCompositionEnd?: () => void;
}

export interface VisibilitySelectorProps {
  value: Visibility;
  onChange: (visibility: Visibility) => void;
  onOpenChange?: (open: boolean) => void;
}
