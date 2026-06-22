import type { EditorAction, EditorState } from "./types";
import { createInitialState } from "./types";

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "INIT_MEMO":
      return {
        ...state,
        content: action.payload.content,
        metadata: action.payload.metadata,
        timestamps: action.payload.timestamps,
      };

    case "UPDATE_CONTENT":
      return {
        ...state,
        content: action.payload,
      };

    case "SET_METADATA":
      return {
        ...state,
        metadata: {
          ...state.metadata,
          ...action.payload,
        },
      };

    case "ADD_LOCAL_FILE":
      return {
        ...state,
        localFiles: [...state.localFiles, action.payload],
      };

    case "REMOVE_LOCAL_FILE":
      return {
        ...state,
        localFiles: state.localFiles.filter((f) => f.previewUrl !== action.payload),
      };

    case "SET_LOCAL_FILES":
      return {
        ...state,
        localFiles: action.payload,
      };

    case "TOGGLE_FOCUS_MODE":
      return {
        ...state,
        ui: {
          ...state.ui,
          isFocusMode: !state.ui.isFocusMode,
        },
      };

    case "SET_LOADING":
      return {
        ...state,
        ui: {
          ...state.ui,
          isLoading: {
            ...state.ui.isLoading,
            [action.payload.key]: action.payload.value,
          },
        },
      };

    case "SET_TIMESTAMPS":
      return {
        ...state,
        timestamps: {
          ...state.timestamps,
          ...action.payload,
        },
      };

    case "SET_RECORDER_BUSY":
      return {
        ...state,
        recorderBusy: action.payload,
      };

    case "SET_EDITOR_MODE":
      return {
        ...state,
        ui: {
          ...state.ui,
          editorMode: action.payload,
        },
      };

    case "RESET":
      return createInitialState();

    default:
      return state;
  }
}
