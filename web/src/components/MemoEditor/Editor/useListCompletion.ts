import { useEffect, useRef } from "react";
import { detectLastListItem, generateListContinuation } from "@/utils/markdown-list-detection";
import { EditorRefActions } from ".";

interface UseListCompletionOptions {
  editorRef: React.RefObject<HTMLTextAreaElement>;
  editorActions: EditorRefActions;
  isInIME: boolean;
}

// Patterns to detect empty list items
const EMPTY_LIST_PATTERNS = [
  /^(\s*)([-*+])\s*$/, // Empty unordered list
  /^(\s*)([-*+])\s+\[([ xX])\]\s*$/, // Empty task list
  /^(\s*)(\d+)[.)]\s*$/, // Empty ordered list
];

const isEmptyListItem = (line: string) => EMPTY_LIST_PATTERNS.some((pattern) => pattern.test(line));

export function useListCompletion({ editorRef, editorActions, isInIME }: UseListCompletionOptions) {
  const isInIMERef = useRef(isInIME);
  isInIMERef.current = isInIME;

  const editorActionsRef = useRef(editorActions);
  editorActionsRef.current = editorActions;

  // Track when composition ends to handle Safari race condition
  // Safari fires keydown(Enter) immediately after compositionend, while Chrome doesn't
  // See: https://github.com/usememos/memos/issues/5469
  const lastCompositionEndRef = useRef(0);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleCompositionEnd = () => {
      lastCompositionEndRef.current = Date.now();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.key !== "Enter" && event.key !== "Tab") ||
        isInIMERef.current ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.key !== "Tab" && event.shiftKey)
      ) {
        return;
      }

      // Safari fix: Ignore Enter key within 100ms of composition end
      // This prevents double-enter behavior when confirming IME input in lists
      if (Date.now() - lastCompositionEndRef.current < 100) {
        return;
      }

      const actions = editorActionsRef.current;
      const cursorPosition = actions.getCursorPosition();
      const contentBeforeCursor = actions.getContent().substring(0, cursorPosition);
      const listInfo = detectLastListItem(contentBeforeCursor);

      if (!listInfo.type) return;

      const lines = contentBeforeCursor.split("\n");
      const currentLine = lines[lines.length - 1];

      if (event.key === "Tab") {
        const currentIndent = listInfo.indent || "";
        if (event.shiftKey && currentIndent.length === 0) return;

        event.preventDefault();

        const strippedLineContent = currentLine.replace(/^(\s*)([-*+]|\d+[.)])\s*(\[([ xX])\])?\s*/, "");
        const lineStartPos = cursorPosition - currentLine.length;
        actions.removeText(lineStartPos, currentLine.length);

        // Reset ordered lists so the regenerated nested item starts at 1.
        const adjustedListInfo = {
          ...listInfo,
          indent: event.shiftKey ? currentIndent.replace(/\t| {1,4}$/, "") : `${currentIndent}\t`,
          number: listInfo.type === "ordered" ? 0 : listInfo.number,
        };

        const continuation = generateListContinuation(adjustedListInfo);
        actions.insertText(continuation + strippedLineContent);

        setTimeout(() => actions.scrollToCursor(), 0);
        return;
      }

      event.preventDefault();

      if (isEmptyListItem(currentLine)) {
        const lineStartPos = cursorPosition - currentLine.length;
        actions.removeText(lineStartPos, currentLine.length);
      } else {
        const continuation = generateListContinuation(listInfo);
        actions.insertText("\n" + continuation);

        // Auto-scroll to keep cursor visible after inserting list item
        setTimeout(() => actions.scrollToCursor(), 0);
      }
    };

    editor.addEventListener("compositionend", handleCompositionEnd);
    editor.addEventListener("keydown", handleKeyDown);
    return () => {
      editor.removeEventListener("compositionend", handleCompositionEnd);
      editor.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}
