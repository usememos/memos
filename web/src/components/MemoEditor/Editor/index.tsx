import { forwardRef, ReactNode, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import TagSuggestions from "./TagSuggestions";
import "@/less/editor.less";

export interface EditorRefActions {
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
  onContentChange: (content: string) => void;
  onPaste: (event: React.ClipboardEvent) => void;
}

const Editor = forwardRef(function Editor(props: Props, ref: React.ForwardedRef<EditorRefActions>) {
  const { className, initialContent, placeholder, onPaste, onContentChange: handleContentChangeCallback } = props;
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

  const updateEditorHeight = () => {
    if (editorRef.current) {
      editorRef.current.style.height = "auto";
      editorRef.current.style.height = (editorRef.current.scrollHeight ?? 0) + "px";
    }
  };

  useImperativeHandle(
    ref,
    () => ({
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
          editorRef.current.focus();
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
    }),
    []
  );

  const handleEditorInput = useCallback(() => {
    handleContentChangeCallback(editorRef.current?.value ?? "");
    updateEditorHeight();
  }, []);

  return (
    <div className={"common-editor-wrapper " + className}>
      <textarea
        className="common-editor-inputer"
        rows={1}
        placeholder={placeholder}
        ref={editorRef}
        onPaste={onPaste}
        onInput={handleEditorInput}
      ></textarea>
      <TagSuggestions editorRef={editorRef} editorActions={ref} />
    </div>
  );
});

export default Editor;
