import { type RefObject, useEffect, useRef } from "react";
import { detectLastListItem, generateListContinuation, renumberOrderedLists } from "@/utils/markdown-list-detection";
import { EditorRefActions } from ".";

interface UseListCompletionOptions {
  editorRef: RefObject<HTMLTextAreaElement | null>;
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

function getMarkerWidthDelta(oldLine: string, newLine: string): number {
  const getNumericMarkerLen = (line: string): number | null => {
    const match = line.match(/^\s*\d+[.)]/);
    return match ? match[0].trim().length : null;
  };

  const oldNum = getNumericMarkerLen(oldLine);
  const newNum = getNumericMarkerLen(newLine);

  if (oldNum !== null && newNum !== null) {
    return newNum - oldNum;
  }

  return 0;
}

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
      if ((event.key !== "Enter" && event.key !== "Tab") || isInIMERef.current || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      // Safari fix: Ignore Enter key within 100ms of composition end
      // This prevents double-enter behavior when confirming IME input in lists
      if (Date.now() - lastCompositionEndRef.current < 100) {
        return;
      }

      const actions = editorActionsRef.current;
      const cursorPosition = actions.getCursorPosition();
      const content = actions.getContent();
      const contentBeforeCursor = content.substring(0, cursorPosition);
      const lines = contentBeforeCursor.split("\n");
      const fullLines = content.split("\n");
      let currentLineNum = lines.length - 1;
      const lastLineContent = fullLines[currentLineNum];

      const listInfo = detectLastListItem(lastLineContent);

      if (!listInfo.type) {
        if (event.key === "Tab" && !event.shiftKey) {
          event.preventDefault();
          actions.insertText("    ");
        }
        return;
      }

      event.preventDefault();

      const lastLineContentBeforeCursor = lines[currentLineNum];
      const lineStartPos = cursorPosition - lastLineContentBeforeCursor.length;
      const offsetInLine = cursorPosition - lineStartPos;
      let cursorOffsetAdjustment = 0;
      if (event.key === "Enter") {
        if (isEmptyListItem(lastLineContentBeforeCursor)) {
          actions.removeText(lineStartPos, lastLineContentBeforeCursor.length);
        } else {
          const continuation = offsetInLine > listInfo.indent ? generateListContinuation(listInfo) : "";
          actions.insertText("\n" + continuation);
          cursorOffsetAdjustment = continuation.length;
          currentLineNum += 1;
          setTimeout(() => actions.scrollToCursor(), 0);
        }
      } else if (event.key === "Tab") {
        const leadingSpaces = lastLineContent.match(/^(\s*)/)?.[1]?.length ?? 0;

        let newLine: string;

        if (event.shiftKey) {
          const spacesToRemove = Math.min(4, leadingSpaces);
          newLine = lastLineContent.slice(spacesToRemove);
          cursorOffsetAdjustment = -spacesToRemove;
        } else {
          const spacesToAdd = 4 - (leadingSpaces % 4);
          newLine = " ".repeat(spacesToAdd) + lastLineContent;
          cursorOffsetAdjustment = spacesToAdd;
        }

        actions.setLine(currentLineNum, newLine);
      }
      const dirtyContent = actions.getContent();
      const newContent = renumberOrderedLists(dirtyContent);
      actions.setContent(newContent);

      const finalLines = newContent.split("\n");
      let newCursorPos = 0;
      for (let i = 0; i < currentLineNum; i++) {
        newCursorPos += finalLines[i].length + 1;
      }
      const finalLine = finalLines[currentLineNum] ?? "";
      const markerWidthDelta = getMarkerWidthDelta(lastLineContent, finalLine);
      const newOffsetInLine = Math.max(0, Math.min(offsetInLine + cursorOffsetAdjustment + markerWidthDelta, finalLine.length));
      newCursorPos += newOffsetInLine;
      actions.setCursorPosition(newCursorPos);
    };

    editor.addEventListener("compositionend", handleCompositionEnd);
    editor.addEventListener("keydown", handleKeyDown);
    return () => {
      editor.removeEventListener("compositionend", handleCompositionEnd);
      editor.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}
