import type { Attachment } from "@/types/proto/api/attachment_service_pb";
import type { Location, MemoRelation } from "@/types/proto/api/memo_service_pb";
import { Visibility } from "@/types/proto/api/memo_service_pb";
import type { LocalFile } from "../types/attachment";

export type LoadingKey = "saving" | "uploading" | "loading" | "transcribing";

/** `limited`: the hourly budget is spent, so asking again cannot help. `stale`: the draft changed after an empty answer. */
export type TagSuggestions = { status: "loading" | "error" | "limited" } | { status: "ready"; tags: string[]; stale?: boolean };

export interface EditorState {
  tagSuggestions?: TagSuggestions;
  content: string;
  metadata: {
    visibility: Visibility;
    /** Destination chosen in an unscoped new-memo composer. */
    space?: string;
    attachments: Attachment[];
    relations: MemoRelation[];
    location?: Location;
  };
  ui: {
    isFocusMode: boolean;
    pendingInlineImageInsertions: number;
    isLoading: {
      saving: boolean;
      uploading: boolean;
      loading: boolean;
      transcribing: boolean;
    };
  };
  timestamps: {
    createTime?: Date;
    updateTime?: Date;
  };
  localFiles: LocalFile[];
  /** The order of saved attachments and new files together, as keys (see utils/attachmentOrder).
   *  Empty until the user reorders; the save keeps it. */
  attachmentOrder: string[];
  /** Whether an audio recording is in flight; gates save. The recorder's full
   *  state lives in useAudioRecorder — only this shared bit reaches the store. */
  recorderBusy: boolean;
  drawingNeedsMemoUpdate?: boolean;
  drawingSaveError?: "editor.drawing.saved-needs-update" | "editor.drawing.saved-without-drawing";
  /** Draft-local acceptance history, retained across Undo but cleared on reset. */
  acceptedSuggestionIds: string[];
}

export type EditorAction =
  | { type: "INIT_MEMO"; payload: { content: string; metadata: EditorState["metadata"]; timestamps: EditorState["timestamps"] } }
  | { type: "UPDATE_CONTENT"; payload: { content: string } }
  | { type: "SET_METADATA"; payload: Partial<EditorState["metadata"]> }
  | { type: "ADD_LOCAL_FILE"; payload: LocalFile }
  | { type: "REMOVE_LOCAL_FILE"; payload: string }
  | { type: "SET_LOCAL_FILES"; payload: LocalFile[] }
  | { type: "SET_ATTACHMENT_ORDER"; payload: string[] }
  | { type: "TOGGLE_FOCUS_MODE" }
  | { type: "SET_LOADING"; payload: { key: LoadingKey; value: boolean } }
  | { type: "SET_PENDING_INLINE_IMAGE_INSERTIONS"; payload: number }
  | { type: "SET_TIMESTAMPS"; payload: Partial<EditorState["timestamps"]> }
  | { type: "SET_RECORDER_BUSY"; payload: boolean }
  | { type: "ACCEPT_SUGGESTION"; payload: string }
  | { type: "SET_DRAWING_SAVE_ERROR"; payload: EditorState["drawingSaveError"] }
  | { type: "SET_DRAWING_MEMO_UPDATE"; payload: boolean }
  | { type: "SET_TAG_SUGGESTIONS"; payload: EditorState["tagSuggestions"] }
  | { type: "RESET" };

// Module-private template for createInitialState.
const defaultState: EditorState = {
  content: "",
  metadata: {
    visibility: Visibility.PRIVATE,
    attachments: [],
    relations: [],
    location: undefined,
  },
  ui: {
    isFocusMode: false,
    pendingInlineImageInsertions: 0,
    isLoading: {
      saving: false,
      uploading: false,
      loading: false,
      transcribing: false,
    },
  },
  timestamps: {
    createTime: undefined,
    updateTime: undefined,
  },
  localFiles: [],
  attachmentOrder: [],
  recorderBusy: false,
  acceptedSuggestionIds: [],
};

/** Fresh initial state for a mounting editor. */
export function createInitialState(initialFocusMode = false): EditorState {
  return {
    ...defaultState,
    ui: { ...defaultState.ui, isFocusMode: initialFocusMode },
  };
}
