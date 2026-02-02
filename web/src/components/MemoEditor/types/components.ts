import type { LatLng } from "leaflet";
import type { Location, Memo, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import type { EditorRefActions } from "../Editor";
import type { Command } from "../Editor/commands";
import type { LocationState } from "./insert-menu";

export interface MemoEditorProps {
  className?: string;
  cacheKey?: string;
  placeholder?: string;
  memoName?: string;
  parentMemoName?: string;
  autoFocus?: boolean;
  onConfirm?: (memoName: string) => void;
  onCancel?: () => void;
}

export interface EditorContentProps {
  placeholder?: string;
  autoFocus?: boolean;
}

export interface EditorToolbarProps {
  onSave: () => void;
  onCancel?: () => void;
  memoName?: string;
}

export interface EditorMetadataProps {
  memoName?: string;
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

export interface LinkMemoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchText: string;
  onSearchChange: (text: string) => void;
  filteredMemos: Memo[];
  isFetching: boolean;
  onSelectMemo: (memo: Memo) => void;
}

export interface LocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: LocationState;
  locationInitialized: boolean;
  onPositionChange: (position: LatLng) => void;
  onUpdateCoordinate: (type: "lat" | "lng", value: string) => void;
  onPlaceholderChange: (placeholder: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export interface InsertMenuProps {
  isUploading?: boolean;
  location?: Location;
  onLocationChange: (location?: Location) => void;
  onToggleFocusMode?: () => void;
  memoName?: string;
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
