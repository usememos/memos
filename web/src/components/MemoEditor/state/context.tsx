import { createContext, type Dispatch, type FC, type PropsWithChildren, useContext, useRef, useSyncExternalStore } from "react";
import { editorActions } from "./actions";
import { editorReducer } from "./reducer";
import type { EditorAction, EditorState } from "./types";
import { createInitialState } from "./types";

/**
 * The editor's shared state is an external store (not a useReducer in the
 * provider) so consumers can subscribe to just the slice they read via
 * `useEditorSelector`. Content changes on every keystroke; routing it through a
 * single context value would re-render every consumer (toolbar, insert menu,
 * metadata) per keystroke. With per-slice subscriptions, only the components
 * whose slice actually changed re-render.
 */
export interface EditorStore {
  getState: () => EditorState;
  subscribe: (listener: () => void) => () => void;
  dispatch: Dispatch<EditorAction>;
  actions: typeof editorActions;
}

function createEditorStore(initial: EditorState): EditorStore {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch: (action) => {
      const next = editorReducer(state, action);
      if (next === state) {
        return;
      }
      state = next;
      for (const listener of listeners) {
        listener();
      }
    },
    actions: editorActions,
  };
}

const EditorStoreContext = createContext<EditorStore | null>(null);

export const useEditorStore = (): EditorStore => {
  const store = useContext(EditorStoreContext);
  if (!store) {
    throw new Error("useEditorStore must be used within EditorProvider");
  }
  return store;
};

/**
 * Dispatch + imperative state access. Does NOT subscribe — components that only
 * dispatch (or read state on-demand, e.g. on save) won't re-render on changes.
 */
export const useEditorContext = () => {
  const store = useEditorStore();
  return { dispatch: store.dispatch, actions: store.actions, getState: store.getState };
};

/**
 * Subscribe to a derived slice of editor state. Re-renders only when the
 * selected value changes (Object.is). Selectors must return primitives or
 * stable references (raw state slices) — not freshly-built objects/arrays.
 */
export function useEditorSelector<T>(selector: (state: EditorState) => T): T {
  const store = useEditorStore();
  const snapshot = () => selector(store.getState());
  return useSyncExternalStore(store.subscribe, snapshot, snapshot);
}

interface EditorProviderProps extends PropsWithChildren {
  initialEditorState?: EditorState;
}

export const EditorProvider: FC<EditorProviderProps> = ({ children, initialEditorState }) => {
  // Created once; the store instance is stable across renders.
  const storeRef = useRef<EditorStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createEditorStore(initialEditorState ?? createInitialState());
  }
  return <EditorStoreContext.Provider value={storeRef.current}>{children}</EditorStoreContext.Provider>;
};
