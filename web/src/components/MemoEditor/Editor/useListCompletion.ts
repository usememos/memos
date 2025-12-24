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

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || isInIMERef.current || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const actions = editorActionsRef.current;
      const cursorPosition = actions.getCursorPosition();
      const contentBeforeCursor = actions.getContent().substring(0, cursorPosition);
      const listInfo = detectLastListItem(contentBeforeCursor);

      if (!listInfo.type) return;

      event.preventDefault();

      const lines = contentBeforeCursor.split("\n");
      const currentLine = lines[lines.length - 1];

      if (isEmptyListItem(currentLine)) {
        const lineStartPos = cursorPosition - currentLine.length;
        actions.removeText(lineStartPos, currentLine.length);
      } else {
        const continuation = generateListContinuation(listInfo);
        actions.insertText("\n" + continuation);
      }
    };

    editor.addEventListener("keydown", handleKeyDown);
    return () => editor.removeEventListener("keydown", handleKeyDown);
  }, []);
}
