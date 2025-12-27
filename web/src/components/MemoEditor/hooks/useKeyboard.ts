import { useEffect } from "react";
import { FOCUS_MODE_TOGGLE_KEY } from "../constants";
import type { EditorRefActions } from "../Editor";

interface UseKeyboardOptions {
  onSave: () => void;
  onToggleFocusMode?: () => void;
}

export const useKeyboard = (_editorRef: React.RefObject<EditorRefActions | null>, options: UseKeyboardOptions) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to save
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        options.onSave();
        return;
      }

      // 'f' key to toggle focus mode (only if no modifiers and not in input)
      if (event.key === FOCUS_MODE_TOGGLE_KEY && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
        const target = event.target as HTMLElement;
        // Don't trigger if user is typing in an input/textarea
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA" && !target.isContentEditable) {
          event.preventDefault();
          options.onToggleFocusMode?.();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [options]);
};
