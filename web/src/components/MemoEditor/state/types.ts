import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import type { Location, MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { type EditorMode, getPreferredEditorMode } from "../editorMode";
import type { LocalFile } from "../types/attachment";

export type LoadingKey = "saving" | "uploading" | "loading";
export type AudioRecorderPermission = "unknown" | "granted" | "denied";
export type AudioRecorderStatus = "idle" | "requesting_permission" | "recording" | "error" | "unsupported";

export interface EditorState {
  content: string;
  metadata: {
    visibility: Visibility;
    attachments: Attachment[];
    relations: MemoRelation[];
    location?: Location;
  };
  ui: {
    isFocusMode: boolean;
    isLoading: {
      saving: boolean;
      uploading: boolean;
      loading: boolean;
    };
    isComposing: boolean;
    editorMode: EditorMode;
  };
  timestamps: {
    createTime?: Date;
    updateTime?: Date;
  };
  localFiles: LocalFile[];
  audioRecorder: {
    isSupported: boolean;
    permission: AudioRecorderPermission;
    status: AudioRecorderStatus;
    elapsedSeconds: number;
    error?: string;
  };
}

export type EditorAction =
  | { type: "INIT_MEMO"; payload: { content: string; metadata: EditorState["metadata"]; timestamps: EditorState["timestamps"] } }
  | { type: "UPDATE_CONTENT"; payload: string }
  | { type: "SET_METADATA"; payload: Partial<EditorState["metadata"]> }
  | { type: "ADD_ATTACHMENT"; payload: Attachment }
  | { type: "REMOVE_ATTACHMENT"; payload: string }
  | { type: "ADD_RELATION"; payload: MemoRelation }
  | { type: "REMOVE_RELATION"; payload: string }
  | { type: "ADD_LOCAL_FILE"; payload: LocalFile }
  | { type: "REMOVE_LOCAL_FILE"; payload: string }
  | { type: "SET_LOCAL_FILES"; payload: LocalFile[] }
  | { type: "CLEAR_LOCAL_FILES" }
  | { type: "TOGGLE_FOCUS_MODE" }
  | { type: "SET_LOADING"; payload: { key: LoadingKey; value: boolean } }
  | { type: "SET_COMPOSING"; payload: boolean }
  | { type: "SET_TIMESTAMPS"; payload: Partial<EditorState["timestamps"]> }
  | { type: "SET_AUDIO_RECORDER_SUPPORT"; payload: boolean }
  | { type: "SET_AUDIO_RECORDER_PERMISSION"; payload: AudioRecorderPermission }
  | { type: "SET_AUDIO_RECORDER_STATUS"; payload: AudioRecorderStatus }
  | { type: "SET_AUDIO_RECORDER_ELAPSED"; payload: number }
  | { type: "SET_AUDIO_RECORDER_ERROR"; payload?: string }
  | { type: "SET_EDITOR_MODE"; payload: EditorMode }
  | { type: "RESET" };

// Module-private template for createInitialState — not exported because its
// hardcoded editorMode ignores the persisted preference; always go through
// createInitialState() for a real initial state.
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
    isLoading: {
      saving: false,
      uploading: false,
      loading: false,
    },
    isComposing: false,
    editorMode: "wysiwyg",
  },
  timestamps: {
    createTime: undefined,
    updateTime: undefined,
  },
  localFiles: [],
  audioRecorder: {
    isSupported: true,
    permission: "unknown",
    status: "idle",
    elapsedSeconds: 0,
    error: undefined,
  },
};

/**
 * Fresh initial state for a mounting editor. Reads the persisted mode
 * preference at call time (not module load) so newly opened editors honor a
 * toggle made earlier in the session.
 */
export function createInitialState(): EditorState {
  return {
    ...defaultState,
    ui: { ...defaultState.ui, editorMode: getPreferredEditorMode() },
  };
}
