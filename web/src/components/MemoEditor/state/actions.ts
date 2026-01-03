import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import type { MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
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

  addAttachment: (attachment: Attachment): EditorAction => ({
    type: "ADD_ATTACHMENT",
    payload: attachment,
  }),

  removeAttachment: (name: string): EditorAction => ({
    type: "REMOVE_ATTACHMENT",
    payload: name,
  }),

  addRelation: (relation: MemoRelation): EditorAction => ({
    type: "ADD_RELATION",
    payload: relation,
  }),

  removeRelation: (name: string): EditorAction => ({
    type: "REMOVE_RELATION",
    payload: name,
  }),

  addLocalFile: (file: LocalFile): EditorAction => ({
    type: "ADD_LOCAL_FILE",
    payload: file,
  }),

  removeLocalFile: (previewUrl: string): EditorAction => ({
    type: "REMOVE_LOCAL_FILE",
    payload: previewUrl,
  }),

  clearLocalFiles: (): EditorAction => ({
    type: "CLEAR_LOCAL_FILES",
  }),

  toggleFocusMode: (): EditorAction => ({
    type: "TOGGLE_FOCUS_MODE",
  }),

  setLoading: (key: LoadingKey, value: boolean): EditorAction => ({
    type: "SET_LOADING",
    payload: { key, value },
  }),

  setDragging: (value: boolean): EditorAction => ({
    type: "SET_DRAGGING",
    payload: value,
  }),

  setComposing: (value: boolean): EditorAction => ({
    type: "SET_COMPOSING",
    payload: value,
  }),

  reset: (): EditorAction => ({
    type: "RESET",
  }),
};
