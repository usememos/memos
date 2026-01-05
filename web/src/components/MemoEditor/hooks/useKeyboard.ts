import { useEffect } from "react";
import type { EditorRefActions } from "../Editor";

interface UseKeyboardOptions {
  onSave: () => void;
}

export const useKeyboard = (_editorRef: React.RefObject<EditorRefActions | null>, options: UseKeyboardOptions) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        options.onSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [options]);
};
