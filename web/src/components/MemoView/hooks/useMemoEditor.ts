import { useState } from "react";

export const useMemoEditor = () => {
  const [showEditor, setShowEditor] = useState(false);

  return {
    showEditor,
    openEditor: () => setShowEditor(true),
    handleEditorConfirm: () => {
      setShowEditor(false);
    },
    handleEditorCancel: () => setShowEditor(false),
  };
};
