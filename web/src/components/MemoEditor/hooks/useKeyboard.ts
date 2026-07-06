import { useEffect, useRef } from "react";
import type { EditorController } from "../types/editorController";

export const useKeyboard = (editorRef: React.RefObject<EditorController | null>, onSave: () => void) => {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") {
        return;
      }

      if (!editorRef.current?.hasFocus()) {
        return;
      }

      event.preventDefault();
      onSaveRef.current();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorRef]);
};
