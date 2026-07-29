import { type ComponentType, createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { loadMemoEditor } from "@/components/MemoEditor/loader";
import type { MemoEditorProps } from "@/components/MemoEditor/types";
import { useTranslate } from "@/utils/i18n";

interface GlobalMemoEditorContextValue {
  isOpen: boolean;
  openEditor: () => void;
}

const GlobalMemoEditorContext = createContext<GlobalMemoEditorContextValue>({
  isOpen: false,
  openEditor: () => {},
});

export function GlobalMemoEditorProvider({ children }: { children: ReactNode }) {
  const t = useTranslate();
  const [isOpen, setIsOpen] = useState(false);
  const [EditorComponent, setEditorComponent] = useState<ComponentType<MemoEditorProps>>();

  const openEditor = useCallback(() => {
    setIsOpen(true);
    void loadMemoEditor()
      .then(({ default: MemoEditor }) => setEditorComponent(() => MemoEditor))
      .catch(() => setIsOpen(false));
  }, []);
  const closeEditor = useCallback(() => setIsOpen(false), []);
  const value = useMemo(() => ({ isOpen, openEditor }), [isOpen, openEditor]);

  return (
    <GlobalMemoEditorContext.Provider value={value}>
      {children}
      {isOpen && EditorComponent && (
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
  return useContext(GlobalMemoEditorContext);
}
