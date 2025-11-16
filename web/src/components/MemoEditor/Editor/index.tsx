import { forwardRef, ReactNode, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Command } from "../types/command";
import CommandSuggestions from "./CommandSuggestions";
import { editorCommands } from "./commands";
import TagSuggestions from "./TagSuggestions";
import { useListAutoCompletion } from "./useListAutoCompletion";

/**
 * Editor height constraints
 * - Normal mode: Limited to 50% viewport height to avoid excessive scrolling
 * - Focus mode: Minimum 50vh on mobile, 60vh on desktop for immersive writing
 */
const EDITOR_HEIGHT = {
  normal: "max-h-[50vh]",
  focusMode: {
    mobile: "min-h-[50vh]",
    desktop: "md:min-h-[60vh]",
  },
} as const;

export interface EditorRefActions {
  getEditor: () => HTMLTextAreaElement | null;
  focus: FunctionType;
  scrollToCursor: FunctionType;
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

interface Props {
  className: string;
  initialContent: string;
  placeholder: string;
  tools?: ReactNode;
  commands?: Command[];
  onContentChange: (content: string) => void;
  onPaste: (event: React.ClipboardEvent) => void;
  /** Whether Focus Mode is active - adjusts height constraints for immersive writing */
  isFocusMode?: boolean;
}

const Editor = forwardRef(function Editor(props: Props, ref: React.ForwardedRef<EditorRefActions>) {
  const { className, initialContent, placeholder, onPaste, onContentChange: handleContentChangeCallback, isFocusMode } = props;
  const [isInIME, setIsInIME] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editorRef.current && initialContent) {
      editorRef.current.value = initialContent;
      handleContentChangeCallback(initialContent);
    }
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      updateEditorHeight();
    }
  }, [editorRef.current?.value]);

  const editorActions = {
    getEditor: () => {
      return editorRef.current;
    },
    focus: () => {
      editorRef.current?.focus();
    },
    scrollToCursor: () => {
      if (editorRef.current) {
        editorRef.current.scrollTop = editorRef.current.scrollHeight;
      }
    },
    insertText: (content = "", prefix = "", suffix = "") => {
      if (!editorRef.current) {
        return;
      }

      const cursorPosition = editorRef.current.selectionStart;
      const endPosition = editorRef.current.selectionEnd;
      const prevValue = editorRef.current.value;
      const value =
        prevValue.slice(0, cursorPosition) +
        prefix +
        (content || prevValue.slice(cursorPosition, endPosition)) +
        suffix +
        prevValue.slice(endPosition);

      editorRef.current.value = value;
      editorRef.current.focus();
      editorRef.current.selectionEnd = endPosition + prefix.length + content.length;
      handleContentChangeCallback(editorRef.current.value);
      updateEditorHeight();
    },
    removeText: (start: number, length: number) => {
      if (!editorRef.current) {
        return;
      }

      const prevValue = editorRef.current.value;
      const value = prevValue.slice(0, start) + prevValue.slice(start + length);
      editorRef.current.value = value;
      editorRef.current.focus();
      editorRef.current.selectionEnd = start;
      handleContentChangeCallback(editorRef.current.value);
      updateEditorHeight();
    },
    setContent: (text: string) => {
      if (editorRef.current) {
        editorRef.current.value = text;
        handleContentChangeCallback(editorRef.current.value);
        updateEditorHeight();
      }
    },
    getContent: (): string => {
      return editorRef.current?.value ?? "";
    },
    getCursorPosition: (): number => {
      return editorRef.current?.selectionStart ?? 0;
    },
    getSelectedContent: () => {
      const start = editorRef.current?.selectionStart;
      const end = editorRef.current?.selectionEnd;
      return editorRef.current?.value.slice(start, end) ?? "";
    },
    setCursorPosition: (startPos: number, endPos?: number) => {
      const _endPos = isNaN(endPos as number) ? startPos : (endPos as number);
      editorRef.current?.setSelectionRange(startPos, _endPos);
    },
    getCursorLineNumber: () => {
      const cursorPosition = editorRef.current?.selectionStart ?? 0;
      const lines = editorRef.current?.value.slice(0, cursorPosition).split("\n") ?? [];
      return lines.length - 1;
    },
    getLine: (lineNumber: number) => {
      return editorRef.current?.value.split("\n")[lineNumber] ?? "";
    },
    setLine: (lineNumber: number, text: string) => {
      const lines = editorRef.current?.value.split("\n") ?? [];
      lines[lineNumber] = text;
      if (editorRef.current) {
        editorRef.current.value = lines.join("\n");
        editorRef.current.focus();
        handleContentChangeCallback(editorRef.current.value);
        updateEditorHeight();
      }
    },
  };

  useImperativeHandle(ref, () => editorActions, []);

  const updateEditorHeight = () => {
    if (editorRef.current) {
      editorRef.current.style.height = "auto";
      editorRef.current.style.height = (editorRef.current.scrollHeight ?? 0) + "px";
    }
  };

  const handleEditorInput = useCallback(() => {
    handleContentChangeCallback(editorRef.current?.value ?? "");
    updateEditorHeight();
  }, []);

  // Auto-complete markdown lists when pressing Enter
  useListAutoCompletion({
    editorRef,
    editorActions,
    isInIME,
  });

  return (
    <div
      className={cn(
        "flex flex-col justify-start items-start relative w-full h-auto bg-inherit",
        isFocusMode ? "flex-1" : EDITOR_HEIGHT.normal,
        className,
      )}
    >
      <textarea
        className={cn(
          "w-full my-1 text-base resize-none overflow-x-hidden overflow-y-auto bg-transparent outline-none placeholder:opacity-70 whitespace-pre-wrap break-words",
          isFocusMode ? `h-auto ${EDITOR_HEIGHT.focusMode.mobile} ${EDITOR_HEIGHT.focusMode.desktop}` : "h-full",
        )}
        rows={1}
        placeholder={placeholder}
        ref={editorRef}
        onPaste={onPaste}
        onInput={handleEditorInput}
        onCompositionStart={() => setIsInIME(true)}
        onCompositionEnd={() => setTimeout(() => setIsInIME(false))}
      ></textarea>
      <TagSuggestions editorRef={editorRef} editorActions={ref} />
      <CommandSuggestions editorRef={editorRef} editorActions={ref} commands={editorCommands} />
    </div>
  );
});

export default Editor;
