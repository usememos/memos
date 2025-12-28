import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { EDITOR_HEIGHT } from "../constants";
import type { EditorProps } from "../types";
import { editorCommands } from "./commands";
import SlashCommands from "./SlashCommands";
import TagSuggestions from "./TagSuggestions";
import { useListCompletion } from "./useListCompletion";

export interface EditorRefActions {
  getEditor: () => HTMLTextAreaElement | null;
  focus: () => void;
  scrollToCursor: () => void;
  insertText: (text: string, prefix?: string, suffix?: string) => void;
  removeText: (start: number, length: number) => void;
  setContent: (text: string) => void;
  getContent: () => string;
  getSelectedContent: () => string;
  getCursorPosition: () => number;
  setCursorPosition: (startPos: number, endPos?: number) => void;
  getCursorLineNumber: () => number;
  getLine: (lineNumber: number) => string;
  setLine: (lineNumber: number, text: string) => void;
}

const Editor = forwardRef(function Editor(props: EditorProps, ref: React.ForwardedRef<EditorRefActions>) {
  const {
    className,
    initialContent,
    placeholder,
    onPaste,
    onContentChange: handleContentChangeCallback,
    isFocusMode,
    isInIME = false,
    onCompositionStart,
    onCompositionEnd,
  } = props;
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

  const editorActions: EditorRefActions = useMemo(
    () => ({
      getEditor: () => editorRef.current,
      focus: () => editorRef.current?.focus(),
      scrollToCursor: () => {
        if (editorRef.current) {
          editorRef.current.scrollTop = editorRef.current.scrollHeight;
        }
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
      removeText: (start: number, length: number) => {
        const editor = editorRef.current;
        if (!editor) return;

        editor.value = editor.value.slice(0, start) + editor.value.slice(start + length);
        editor.focus();
        editor.selectionEnd = start;
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
      getCursorPosition: () => editorRef.current?.selectionStart ?? 0,
      getSelectedContent: () => {
        const editor = editorRef.current;
        if (!editor) return "";
        return editor.value.slice(editor.selectionStart, editor.selectionEnd);
      },
      setCursorPosition: (startPos: number, endPos?: number) => {
        const endPosition = Number.isNaN(endPos) ? startPos : (endPos as number);
        editorRef.current?.setSelectionRange(startPos, endPosition);
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
    [updateContent],
  );

  useImperativeHandle(ref, () => editorActions, [editorActions]);

  const handleEditorInput = useCallback(() => {
    if (editorRef.current) {
      handleContentChangeCallback(editorRef.current.value);
      updateEditorHeight();
    }
  }, [handleContentChangeCallback, updateEditorHeight]);

  // Auto-complete markdown lists when pressing Enter
  useListCompletion({
    editorRef,
    editorActions,
    isInIME,
  });

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
          "w-full my-1 text-base resize-none overflow-x-hidden overflow-y-auto bg-transparent outline-none placeholder:opacity-70 whitespace-pre-wrap break-words",
          // Focus mode: flex-1 h-0 to grow within flex container; Normal: h-full to fill wrapper
          isFocusMode ? "flex-1 h-0" : "h-full",
        )}
        rows={1}
        placeholder={placeholder}
        ref={editorRef}
        onPaste={onPaste}
        onInput={handleEditorInput}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
      ></textarea>
      <TagSuggestions editorRef={editorRef} editorActions={ref} />
      <SlashCommands editorRef={editorRef} editorActions={ref} commands={editorCommands} />
    </div>
  );
});

export default Editor;
