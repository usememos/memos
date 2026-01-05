import { createContext, type Dispatch, type FC, type PropsWithChildren, useContext, useMemo, useReducer } from "react";
import { editorActions } from "./actions";
import { editorReducer } from "./reducer";
import type { EditorAction, EditorState } from "./types";
import { initialState } from "./types";

interface EditorContextValue {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
  actions: typeof editorActions;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export const useEditorContext = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditorContext must be used within EditorProvider");
  }
  return context;
};

interface EditorProviderProps extends PropsWithChildren {
  initialEditorState?: EditorState;
}

export const EditorProvider: FC<EditorProviderProps> = ({ children, initialEditorState }) => {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState || initialState);

  const value = useMemo<EditorContextValue>(
    () => ({
      state,
      dispatch,
      actions: editorActions,
    }),
    [state],
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
};
