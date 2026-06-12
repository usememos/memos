import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import getCaretCoordinates from "textarea-caret";
import { cn } from "@/lib/utils";
import { EDITOR_HEIGHT } from "../constants";
import type { EditorController } from "../types/editorController";

interface PlainEditorProps {
  className: string;
  initialContent: string;
  placeholder: string;
  onContentChange: (content: string) => void;
  onPaste: (event: React.ClipboardEvent) => void;
  isFocusMode?: boolean;
}

// Low-level string-surgery handle over the textarea. Internal to this file —
// outside callers only ever see the EditorController exposed via the ref.
interface TextareaActions {
  getEditor: () => HTMLTextAreaElement | null;
  focus: () => void;
  scrollToCursor: () => void;
  insertText: (text: string, prefix?: string, suffix?: string) => void;
  setContent: (text: string) => void;
  getContent: () => string;
  getSelectedContent: () => string;
  getCursorPosition: () => number;
  setCursorPosition: (startPos: number, endPos?: number) => void;
  getCursorLineNumber: () => number;
  getLine: (lineNumber: number) => string;
  setLine: (lineNumber: number, text: string) => void;
}

const TASK_PREFIX = "- [ ] ";

const PlainEditor = forwardRef(function PlainEditor(props: PlainEditorProps, ref: React.ForwardedRef<EditorController>) {
  const { className, initialContent, placeholder, onPaste, onContentChange: handleContentChangeCallback, isFocusMode } = props;
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const updateEditorHeight = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.style.height = "auto";
      editorRef.current.style.height = `${editorRef.current.scrollHeight ?? 0}px`;
    }
  }, []);

  const updateContent = useCallback(() => {
    if (editorRef.current) {
      handleContentChangeCallback(editorRef.current.value);
      updateEditorHeight();
    }
  }, [handleContentChangeCallback, updateEditorHeight]);

  const scrollToCaret = useCallback((options: { force?: boolean } = {}) => {
    const editor = editorRef.current;
    if (!editor) return;

    const { force = false } = options;
    const caret = getCaretCoordinates(editor, editor.selectionEnd);

    if (force) {
      editor.scrollTop = Math.max(0, caret.top - editor.clientHeight / 2);
      return;
    }

    const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 24;
    const viewportBottom = editor.scrollTop + editor.clientHeight;
    // Scroll if cursor is near or beyond bottom edge (within 2 lines)
    if (caret.top + lineHeight * 2 > viewportBottom) {
      editor.scrollTop = Math.max(0, caret.top - editor.clientHeight / 2);
    }
  }, []);

  useEffect(() => {
    if (editorRef.current && initialContent) {
      editorRef.current.value = initialContent;
      handleContentChangeCallback(initialContent);
      updateEditorHeight();
    }
    // Only run once on mount to set initial content
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update editor when content is externally changed (e.g., reset after save)
  useEffect(() => {
    if (editorRef.current && editorRef.current.value !== initialContent) {
      editorRef.current.value = initialContent;
      updateEditorHeight();
    }
  }, [initialContent, updateEditorHeight]);

  const actions: TextareaActions = useMemo(
    () => ({
      getEditor: () => editorRef.current,
      focus: () => editorRef.current?.focus(),
      scrollToCursor: () => {
        scrollToCaret({ force: true });
      },
      insertText: (content = "", prefix = "", suffix = "") => {
        const editor = editorRef.current;
        if (!editor) return;

        const cursorPos = editor.selectionStart;
        const endPos = editor.selectionEnd;
        const prev = editor.value;
        const actual = content || prev.slice(cursorPos, endPos);
        editor.value = prev.slice(0, cursorPos) + prefix + actual + suffix + prev.slice(endPos);

        editor.focus();
        editor.setSelectionRange(cursorPos + prefix.length + actual.length, cursorPos + prefix.length + actual.length);
        updateContent();
      },
      setContent: (text: string) => {
        const editor = editorRef.current;
        if (editor) {
          editor.value = text;
          updateContent();
        }
      },
      getContent: () => editorRef.current?.value ?? "",
      getSelectedContent: () => {
        const editor = editorRef.current;
        if (!editor) return "";
        return editor.value.slice(editor.selectionStart, editor.selectionEnd);
      },
      getCursorPosition: () => editorRef.current?.selectionStart ?? 0,
      setCursorPosition: (startPos: number, endPos?: number) => {
        const editor = editorRef.current;
        if (!editor) return;
        // setSelectionRange requires valid arguments; default to startPos if endPos is undefined
        const endPosition = endPos !== undefined && !Number.isNaN(endPos) ? endPos : startPos;
        editor.setSelectionRange(startPos, endPosition);
      },
      getCursorLineNumber: () => {
        const editor = editorRef.current;
        if (!editor) return 0;
        const lines = editor.value.slice(0, editor.selectionStart).split("\n");
        return lines.length - 1;
      },
      getLine: (lineNumber: number) => editorRef.current?.value.split("\n")[lineNumber] ?? "",
      setLine: (lineNumber: number, text: string) => {
        const editor = editorRef.current;
        if (!editor) return;
        const lines = editor.value.split("\n");
        lines[lineNumber] = text;
        editor.value = lines.join("\n");
        editor.focus();
        updateContent();
      },
    }),
    [updateContent, scrollToCaret],
  );

  // Realize the shared EditorController contract on top of textarea surgery, so
  // the toolbar's formatting toggles and the mode-routing host talk markdown.
  useImperativeHandle(
    ref,
    (): EditorController => ({
      focus: () => actions.focus(),
      hasFocus: () => {
        const element = actions.getEditor();
        return Boolean(element) && document.activeElement === element;
      },
      isEmpty: () => actions.getContent().trim() === "",
      getMarkdown: () => actions.getContent(),
      setMarkdown: (markdown) => actions.setContent(markdown),
      insertMarkdown: (markdown) => {
        if (!markdown) return;
        const content = actions.getContent();
        const cursor = actions.getCursorPosition();
        const before = content.slice(0, cursor);
        const after = content.slice(cursor);
        const prefix = before.length === 0 || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
        const suffix = after.length === 0 || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
        actions.insertText(markdown, prefix, suffix);
      },
      scrollToCursor: () => actions.scrollToCursor(),
      selectAll: () => actions.setCursorPosition(0, actions.getContent().length),
      toggleBold: () => toggleTextStyle(actions, "**"),
      toggleItalic: () => toggleTextStyle(actions, "*"),
      toggleTaskList: () => {
        const lineNumber = actions.getCursorLineNumber();
        const line = actions.getLine(lineNumber);
        const taskMatch = line.match(/^(\s*)- \[[ xX]\] /);
        if (taskMatch) {
          actions.setLine(lineNumber, taskMatch[1] + line.slice(taskMatch[0].length));
        } else {
          const indent = line.match(/^(\s*)/)?.[1] ?? "";
          actions.setLine(lineNumber, `${indent}${TASK_PREFIX}${line.slice(indent.length)}`);
        }
      },
    }),
    [actions],
  );

  const handleEditorInput = useCallback(() => {
    if (editorRef.current) {
      handleContentChangeCallback(editorRef.current.value);
      updateEditorHeight();

      // Auto-scroll to keep cursor visible when typing
      // See: https://github.com/usememos/memos/issues/5469
      scrollToCaret();
    }
  }, [handleContentChangeCallback, updateEditorHeight, scrollToCaret]);

  // Recalculate editor height when focus mode changes
  useEffect(() => {
    updateEditorHeight();
  }, [isFocusMode, updateEditorHeight]);

  return (
    <div
      className={cn(
        "flex flex-col justify-start items-start relative w-full bg-inherit",
        // Focus mode: flex-1 to grow and fill space; Normal: h-auto with max-height
        isFocusMode ? "flex-1" : `h-auto ${EDITOR_HEIGHT.normal}`,
        className,
      )}
    >
      <textarea
        className={cn(
          "w-full text-base resize-none overflow-x-hidden overflow-y-auto bg-transparent outline-none placeholder:opacity-70 whitespace-pre-wrap wrap-break-word",
          // Focus mode: flex-1 h-0 to grow within flex container; Normal: h-full to fill wrapper
          isFocusMode ? "flex-1 h-0" : "h-full",
        )}
        rows={1}
        placeholder={placeholder}
        ref={editorRef}
        onPaste={onPaste}
        onInput={handleEditorInput}
      ></textarea>
    </div>
  );
});

function toggleTextStyle(editor: TextareaActions, delimiter: string): void {
  const cursorPosition = editor.getCursorPosition();
  const selectedContent = editor.getSelectedContent();
  const isStyled = isTextStyled(selectedContent, delimiter);

  if (isStyled) {
    const unstyled = selectedContent.slice(delimiter.length, -delimiter.length);
    editor.insertText(unstyled);
    editor.setCursorPosition(cursorPosition, cursorPosition + unstyled.length);
  } else {
    editor.insertText(`${delimiter}${selectedContent}${delimiter}`);
    editor.setCursorPosition(cursorPosition + delimiter.length, cursorPosition + delimiter.length + selectedContent.length);
  }
}

function isTextStyled(text: string, delimiter: string): boolean {
  if (!text.startsWith(delimiter) || !text.endsWith(delimiter)) {
    return false;
  }
  if (delimiter !== "*") {
    return true;
  }
  const leadingAsterisks = countConsecutive(text, "*", "start");
  const trailingAsterisks = countConsecutive(text, "*", "end");
  return leadingAsterisks % 2 === 1 && trailingAsterisks % 2 === 1;
}

function countConsecutive(text: string, character: string, position: "start" | "end"): number {
  let count = 0;
  let index = position === "start" ? 0 : text.length - 1;
  while (index >= 0 && index < text.length && text[index] === character) {
    count += 1;
    index += position === "start" ? 1 : -1;
  }
  return count;
}

export default PlainEditor;
