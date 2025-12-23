import { useEffect } from "react";
import type { EditorRefActions } from "../Editor";

interface UseKeyboardOptions {
  onSave: () => void;
}

export const useKeyboard = (editorRef: React.RefObject<EditorRefActions | null>, options: UseKeyboardOptions) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to save
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        options.onSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [options]);
};
