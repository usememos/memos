import { useState } from "react";
import { userStore } from "@/store";

export const useMemoEditor = () => {
  const [showEditor, setShowEditor] = useState(false);

  return {
    showEditor,
    openEditor: () => setShowEditor(true),
    handleEditorConfirm: () => {
      setShowEditor(false);
      userStore.setStatsStateId();
    },
    handleEditorCancel: () => setShowEditor(false),
  };
};
