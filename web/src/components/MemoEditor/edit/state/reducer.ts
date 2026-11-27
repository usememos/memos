import type { EditorAction, EditorState } from "./types";
import { createInitialState } from "./types";

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "INIT_MEMO":
      return {
        ...state,
        content: action.payload.content,
        metadata: action.payload.metadata,
        tagSuggestions: undefined,
        timestamps: action.payload.timestamps,
      };

    case "SET_DRAWING_SAVE_ERROR":
      return { ...state, drawingSaveError: action.payload };

    case "SET_DRAWING_MEMO_UPDATE":
      return { ...state, drawingNeedsMemoUpdate: action.payload };

    case "UPDATE_CONTENT": {
      if (state.content === action.payload.content) {
        return state;
      }
      // An empty answer belongs to the draft that was sent. It stays, so the row does not collapse
      // under the writer, and is marked stale so the row can offer to ask again.
      const requested = state.tagSuggestions;
      const kept = requested?.status === "ready" && requested.tags.length === 0 ? { ...requested, stale: true } : requested;
      return {
        ...state,
        content: action.payload.content,
        tagSuggestions: action.payload.content.trim() ? kept : undefined,
      };
    }

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

    case "SET_ATTACHMENT_ORDER":
      return {
        ...state,
        attachmentOrder: action.payload,
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

    case "SET_PENDING_INLINE_IMAGE_INSERTIONS":
      return {
        ...state,
        ui: {
          ...state.ui,
          pendingInlineImageInsertions: action.payload,
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

    case "SET_TAG_SUGGESTIONS":
      return { ...state, tagSuggestions: action.payload };

    case "RESET":
      return createInitialState();

    case "ACCEPT_SUGGESTION":
      return state.acceptedSuggestionIds.includes(action.payload)
        ? state
        : { ...state, acceptedSuggestionIds: [...state.acceptedSuggestionIds, action.payload] };

    default:
      return state;
  }
}
