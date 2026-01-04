import { useEffect } from "react";
import type { EditorRefActions } from "../Editor";

interface UseKeyboardOptions {
  onSave: () => void;
  onTogglePreview?: () => void;
}

export const useKeyboard = (_editorRef: React.RefObject<EditorRefActions | null>, options: UseKeyboardOptions) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to save
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        options.onSave();
      }
      // Cmd/Ctrl + Shift + P to toggle preview
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "p") {
        event.preventDefault();
        options.onTogglePreview?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [options]);
};
