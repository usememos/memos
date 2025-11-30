import { useCallback, useState } from "react";
import { userStore } from "@/store";

export interface UseMemoEditorReturn {
  showEditor: boolean;
  openEditor: () => void;
  handleEditorConfirm: () => void;
  handleEditorCancel: () => void;
}

/**
 * Hook for managing memo editor state and actions
 * Encapsulates all editor-related state and handlers
 */
export const useMemoEditor = (): UseMemoEditorReturn => {
  const [showEditor, setShowEditor] = useState(false);

  const openEditor = useCallback(() => {
    setShowEditor(true);
  }, []);

  const handleEditorConfirm = useCallback(() => {
    setShowEditor(false);
    userStore.setStatsStateId();
  }, []);

  const handleEditorCancel = useCallback(() => {
    setShowEditor(false);
  }, []);

  return {
    showEditor,
    openEditor,
    handleEditorConfirm,
    handleEditorCancel,
  };
};
