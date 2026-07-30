import { type ComponentType, createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loadMemoEditor } from "@/components/MemoEditor/loader";
import type { MemoEditorProps } from "@/components/MemoEditor/types";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useTranslate } from "@/utils/i18n";

interface GlobalMemoEditorContextValue {
  isOpen: boolean;
  openEditor: () => void;
}

const GlobalMemoEditorContext = createContext<GlobalMemoEditorContextValue | null>(null);

export function GlobalMemoEditorProvider({ children }: { children: ReactNode }) {
  const t = useTranslate();
  const currentUserName = useCurrentUser()?.name;
  const [isOpen, setIsOpen] = useState(false);
  const [EditorComponent, setEditorComponent] = useState<ComponentType<MemoEditorProps>>();

  const openEditor = useCallback(() => {
    if (!currentUserName) {
      return;
    }

    setIsOpen(true);
    void loadMemoEditor()
      .then(({ default: MemoEditor }) => setEditorComponent(() => MemoEditor))
      .catch(() => setIsOpen(false));
  }, [currentUserName]);
  const closeEditor = useCallback(() => setIsOpen(false), []);
  const editorIsOpen = !!currentUserName && isOpen;
  const value = useMemo(() => ({ isOpen: editorIsOpen, openEditor }), [editorIsOpen, openEditor]);

  useEffect(() => {
    closeEditor();
  }, [currentUserName, closeEditor]);

  return (
    <GlobalMemoEditorContext.Provider value={value}>
      {children}
      {editorIsOpen && EditorComponent && (
        <EditorComponent
          autoFocus
          initialFocusMode
          cacheKey="global-memo-editor"
          placeholder={t("editor.any-thoughts")}
          onConfirm={closeEditor}
          onCancel={closeEditor}
          onFocusModeExit={closeEditor}
        />
      )}
    </GlobalMemoEditorContext.Provider>
  );
}

export function useGlobalMemoEditor() {
  const context = useContext(GlobalMemoEditorContext);
  if (!context) {
    throw new Error("useGlobalMemoEditor must be used within GlobalMemoEditorProvider");
  }
  return context;
}
