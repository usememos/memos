import { useEffect } from "react";
import type { EditorRefActions } from "../Editor";

interface UseKeyboardOptions {
  onSave: () => void;
}

export const useKeyboard = (editorRef: React.RefObject<EditorRefActions | null>, options: UseKeyboardOptions) => {
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
      options.onSave();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorRef, options]);
};
