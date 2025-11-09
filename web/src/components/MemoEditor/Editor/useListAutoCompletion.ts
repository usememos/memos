import { useEffect, useRef } from "react";
import { detectLastListItem, generateListContinuation } from "@/utils/markdown-list-detection";
import { EditorRefActions } from ".";

interface UseListAutoCompletionOptions {
  editorRef: React.RefObject<HTMLTextAreaElement>;
  editorActions: EditorRefActions;
  isInIME: boolean;
}

/**
 * Custom hook for handling markdown list auto-completion.
 * When the user presses Enter on a list item, this hook automatically
 * continues the list with the appropriate formatting.
 *
 * Supports:
 * - Ordered lists (1. item, 2. item, etc.)
 * - Unordered lists (- item, * item, + item)
 * - Task lists (- [ ] task, - [x] task)
 * - Nested lists with proper indentation
 *
 * This hook manages its own event listeners and cleanup.
 */
export function useListAutoCompletion({ editorRef, editorActions, isInIME }: UseListAutoCompletionOptions) {
  // Use refs to avoid stale closures in event handlers
  const isInIMERef = useRef(isInIME);
  isInIMERef.current = isInIME;

  const editorActionsRef = useRef(editorActions);
  editorActionsRef.current = editorActions;

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle Enter key
      if (event.key !== "Enter") return;

      // Don't handle if in IME composition (for Asian languages)
      if (isInIMERef.current) return;

      // Don't handle if modifier keys are pressed (user wants manual control)
      if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;

      const actions = editorActionsRef.current;
      const cursorPosition = actions.getCursorPosition();
      const contentBeforeCursor = actions.getContent().substring(0, cursorPosition);

      // Detect if we're on a list item
      const listInfo = detectLastListItem(contentBeforeCursor);

      if (listInfo.type) {
        event.preventDefault();

        // Check if current list item is empty (GitHub-style behavior)
        // Extract the current line
        const lines = contentBeforeCursor.split("\n");
        const currentLine = lines[lines.length - 1];

        // Check if line only contains list marker (no content after it)
        const isEmptyListItem =
          /^(\s*)([-*+])\s*$/.test(currentLine) || // Empty unordered list
          /^(\s*)([-*+])\s+\[([ xX])\]\s*$/.test(currentLine) || // Empty task list
          /^(\s*)(\d+)[.)]\s*$/.test(currentLine); // Empty ordered list

        if (isEmptyListItem) {
          // Remove the empty list marker and exit list mode
          const lineStartPos = cursorPosition - currentLine.length;
          actions.removeText(lineStartPos, currentLine.length);
        } else {
          // Continue the list with the next item
          const continuation = generateListContinuation(listInfo);
          actions.insertText("\n" + continuation);
        }
      }
    };

    editor.addEventListener("keydown", handleKeyDown);

    return () => {
      editor.removeEventListener("keydown", handleKeyDown);
    };
  }, []); // Editor ref is stable; state accessed via refs to avoid stale closures
}
