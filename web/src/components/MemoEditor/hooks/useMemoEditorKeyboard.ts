import { useCallback } from "react";
import { TAB_SPACE_WIDTH } from "@/helpers/consts";
import { FOCUS_MODE_EXIT_KEY, FOCUS_MODE_TOGGLE_KEY } from "../constants";
import type { EditorRefActions } from "../Editor";
import { handleEditorKeydownWithMarkdownShortcuts } from "../Editor/markdownShortcuts";

export interface UseMemoEditorKeyboardOptions {
  editorRef: React.RefObject<EditorRefActions>;
  isFocusMode: boolean;
  isComposing: boolean;
  onSave: () => void;
  onToggleFocusMode: () => void;
}

/**
 * Hook for handling keyboard shortcuts in MemoEditor
 * Centralizes all keyboard event handling logic
 */
export const useMemoEditorKeyboard = (options: UseMemoEditorKeyboardOptions) => {
  const { editorRef, isFocusMode, isComposing, onSave, onToggleFocusMode } = options;

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!editorRef.current) {
        return;
      }

      const isMetaKey = event.ctrlKey || event.metaKey;

      // Focus Mode toggle: Cmd/Ctrl + Shift + F
      if (isMetaKey && event.shiftKey && event.key.toLowerCase() === FOCUS_MODE_TOGGLE_KEY) {
        event.preventDefault();
        onToggleFocusMode();
        return;
      }

      // Exit Focus Mode: Escape
      if (event.key === FOCUS_MODE_EXIT_KEY && isFocusMode) {
        event.preventDefault();
        onToggleFocusMode();
        return;
      }

      // Save: Cmd/Ctrl + Enter or Cmd/Ctrl + S
      if (isMetaKey) {
        if (event.key === "Enter" || event.key.toLowerCase() === "s") {
          event.preventDefault();
          onSave();
          return;
        }
        handleEditorKeydownWithMarkdownShortcuts(event, editorRef.current);
      }

      // Tab handling
      if (event.key === "Tab" && !isComposing) {
        event.preventDefault();
        const tabSpace = " ".repeat(TAB_SPACE_WIDTH);
        const cursorPosition = editorRef.current.getCursorPosition();
        const selectedContent = editorRef.current.getSelectedContent();
        editorRef.current.insertText(tabSpace);
        if (selectedContent) {
          editorRef.current.setCursorPosition(cursorPosition + TAB_SPACE_WIDTH);
        }
        return;
      }
    },
    [editorRef, isFocusMode, isComposing, onSave, onToggleFocusMode],
  );

  return { handleKeyDown };
};
