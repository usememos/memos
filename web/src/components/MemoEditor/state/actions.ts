import type { EditorMode } from "../editorMode";
import type { LocalFile } from "../types/attachment";
import type { EditorAction, EditorState, LoadingKey } from "./types";

export const editorActions = {
  initMemo: (payload: { content: string; metadata: EditorState["metadata"]; timestamps: EditorState["timestamps"] }): EditorAction => ({
    type: "INIT_MEMO",
    payload,
  }),

  updateContent: (content: string): EditorAction => ({
    type: "UPDATE_CONTENT",
    payload: content,
  }),

  setMetadata: (metadata: Partial<EditorState["metadata"]>): EditorAction => ({
    type: "SET_METADATA",
    payload: metadata,
  }),

  addLocalFile: (file: LocalFile): EditorAction => ({
    type: "ADD_LOCAL_FILE",
    payload: file,
  }),

  removeLocalFile: (previewUrl: string): EditorAction => ({
    type: "REMOVE_LOCAL_FILE",
    payload: previewUrl,
  }),

  setLocalFiles: (files: LocalFile[]): EditorAction => ({
    type: "SET_LOCAL_FILES",
    payload: files,
  }),

  toggleFocusMode: (): EditorAction => ({
    type: "TOGGLE_FOCUS_MODE",
  }),

  setLoading: (key: LoadingKey, value: boolean): EditorAction => ({
    type: "SET_LOADING",
    payload: { key, value },
  }),

  setTimestamps: (timestamps: Partial<EditorState["timestamps"]>): EditorAction => ({
    type: "SET_TIMESTAMPS",
    payload: timestamps,
  }),

  setRecorderBusy: (value: boolean): EditorAction => ({
    type: "SET_RECORDER_BUSY",
    payload: value,
  }),

  setEditorMode: (mode: EditorMode): EditorAction => ({
    type: "SET_EDITOR_MODE",
    payload: mode,
  }),

  reset: (): EditorAction => ({
    type: "RESET",
  }),
};
