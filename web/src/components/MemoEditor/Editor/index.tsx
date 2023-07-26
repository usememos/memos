import { forwardRef, ReactNode, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import "@/less/editor.less";
import getCaretCoordinates from "textarea-caret";

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
}

interface Props {
  className: string;
  initialContent: string;
  placeholder: string;
  fullscreen: boolean;
  tools?: ReactNode;
  onContentChange: (content: string) => void;
  onPaste: (event: React.ClipboardEvent) => void;
}

const Editor = forwardRef(function Editor(props: Props, ref: React.ForwardedRef<EditorRefActions>) {
  const { className, initialContent, placeholder, fullscreen, onPaste, onContentChange: handleContentChangeCallback } = props;
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [coord, setCoord] = useState({ left: 0, top: 0, height: 0 });

  useEffect(() => {
    if (editorRef.current && initialContent) {
      editorRef.current.value = initialContent;
      handleContentChangeCallback(initialContent);
    }
  }, []);

  useEffect(() => {
    if (editorRef.current && !fullscreen) {
      updateEditorHeight();
    }
  }, [editorRef.current?.value, fullscreen]);

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
    }),
    []
  );

  const handleEditorInput = useCallback(() => {
    if (!editorRef.current) return;
    handleContentChangeCallback(editorRef.current.value);
    updateEditorHeight();
    setCoord(getCaretCoordinates(editorRef.current, editorRef.current.selectionEnd));
  }, []);

  return (
    <div className={"common-editor-wrapper " + className} style={{ position: "relative" }}>
      <textarea
        className="common-editor-inputer"
        rows={1}
        placeholder={placeholder}
        ref={editorRef}
        onPaste={onPaste}
        onInput={handleEditorInput}
      ></textarea>
      <div style={{ position: "absolute", left: coord.left, top: coord.top + coord.height }}>tags</div>
    </div>
  );
});

export default Editor;
