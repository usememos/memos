import { useCallback } from "react";
import { detectLastListItem, generateListContinuation } from "@/utils/markdown-list-detection";
import { EditorRefActions } from ".";

interface UseListAutoCompletionOptions {
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
 */
export function useListAutoCompletion({ editorActions, isInIME }: UseListAutoCompletionOptions) {
  /**
   * Handles the Enter key press to auto-complete list items.
   * Returns true if the event was handled, false otherwise.
   */
  const handleEnterKey = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      // Don't handle if in IME composition (for Asian languages)
      if (isInIME) {
        return false;
      }

      // Don't handle if modifier keys are pressed (user wants manual control)
      if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
        return false;
      }

      const cursorPosition = editorActions.getCursorPosition();
      const contentBeforeCursor = editorActions.getContent().substring(0, cursorPosition);

      // Detect if we're on a list item
      const listInfo = detectLastListItem(contentBeforeCursor);

      if (listInfo.type) {
        event.preventDefault();
        const continuation = generateListContinuation(listInfo);
        editorActions.insertText("\n" + continuation);
        return true;
      }

      return false;
    },
    [editorActions, isInIME],
  );

  return { handleEnterKey };
}
