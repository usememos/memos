import { useEffect, useRef } from "react";
import type { EditorRefActions } from "../Editor";

export const useKeyboard = (editorRef: React.RefObject<EditorRefActions | null>, onSave: () => void) => {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") {
        return;
      }

      const editor = editorRef.current?.getEditor();
      if (!editor) {
        return;
      }

      const activeElement = document.activeElement;
      const target = event.target;
      if (activeElement !== editor && target !== editor) {
        return;
      }

      event.preventDefault();
      onSaveRef.current();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorRef]);
};
