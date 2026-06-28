import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import type { Location, MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import type { LocalFile } from "../types/attachment";

export type LoadingKey = "saving" | "uploading" | "loading";

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
  };
  timestamps: {
    createTime?: Date;
    updateTime?: Date;
  };
  localFiles: LocalFile[];
  /** Whether an audio recording is in flight; gates save. The recorder's full
   *  state lives in useAudioRecorder — only this shared bit reaches the store. */
  recorderBusy: boolean;
}

export type EditorAction =
  | { type: "INIT_MEMO"; payload: { content: string; metadata: EditorState["metadata"]; timestamps: EditorState["timestamps"] } }
  | { type: "UPDATE_CONTENT"; payload: string }
  | { type: "SET_METADATA"; payload: Partial<EditorState["metadata"]> }
  | { type: "ADD_LOCAL_FILE"; payload: LocalFile }
  | { type: "REMOVE_LOCAL_FILE"; payload: string }
  | { type: "SET_LOCAL_FILES"; payload: LocalFile[] }
  | { type: "TOGGLE_FOCUS_MODE" }
  | { type: "SET_LOADING"; payload: { key: LoadingKey; value: boolean } }
  | { type: "SET_TIMESTAMPS"; payload: Partial<EditorState["timestamps"]> }
  | { type: "SET_RECORDER_BUSY"; payload: boolean }
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
    isLoading: {
      saving: false,
      uploading: false,
      loading: false,
    },
  },
  timestamps: {
    createTime: undefined,
    updateTime: undefined,
  },
  localFiles: [],
  recorderBusy: false,
};

/** Fresh initial state for a mounting editor. */
export function createInitialState(): EditorState {
  return {
    ...defaultState,
    ui: { ...defaultState.ui },
  };
}
