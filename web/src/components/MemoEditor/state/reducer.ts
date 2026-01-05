import type { EditorAction, EditorState } from "./types";
import { initialState } from "./types";

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

    case "ADD_ATTACHMENT":
      return {
        ...state,
        metadata: {
          ...state.metadata,
          attachments: [...state.metadata.attachments, action.payload],
        },
      };

    case "REMOVE_ATTACHMENT":
      return {
        ...state,
        metadata: {
          ...state.metadata,
          attachments: state.metadata.attachments.filter((a) => a.name !== action.payload),
        },
      };

    case "ADD_RELATION":
      return {
        ...state,
        metadata: {
          ...state.metadata,
          relations: [...state.metadata.relations, action.payload],
        },
      };

    case "REMOVE_RELATION":
      return {
        ...state,
        metadata: {
          ...state.metadata,
          relations: state.metadata.relations.filter((r) => r.relatedMemo?.name !== action.payload),
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

    case "CLEAR_LOCAL_FILES":
      return {
        ...state,
        localFiles: [],
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

    case "SET_DRAGGING":
      return {
        ...state,
        ui: {
          ...state.ui,
          isDragging: action.payload,
        },
      };

    case "SET_COMPOSING":
      return {
        ...state,
        ui: {
          ...state.ui,
          isComposing: action.payload,
        },
      };

    case "RESET":
      return {
        ...initialState,
      };

    default:
      return state;
  }
}
