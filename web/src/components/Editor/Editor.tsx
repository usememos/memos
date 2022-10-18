import { forwardRef, ReactNode, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import useRefresh from "../../hooks/useRefresh";
import "../../less/editor.less";

export interface EditorRefActions {
  focus: FunctionType;
  insertText: (text: string) => void;
  setContent: (text: string) => void;
  getContent: () => string;
  getCursorPosition: () => number;
}

interface Props {
  className: string;
  initialContent: string;
  placeholder: string;
  fullscreen: boolean;
  tools?: ReactNode;
  onPaste: (event: React.ClipboardEvent) => void;
  onContentChange: (content: string) => void;
}

// eslint-disable-next-line react/display-name
const Editor = forwardRef((props: Props, ref: React.ForwardedRef<EditorRefActions>) => {
  const { className, initialContent, placeholder, fullscreen, onPaste, onContentChange: handleContentChangeCallback } = props;
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const refresh = useRefresh();

  useEffect(() => {
    if (editorRef.current && initialContent) {
      editorRef.current.value = initialContent;
      handleContentChangeCallback(initialContent);
    }
  }, []);

  useEffect(() => {
    if (editorRef.current && !fullscreen) {
      editorRef.current.style.height = "auto";
      editorRef.current.style.height = (editorRef.current.scrollHeight ?? 0) + "px";
    }
  }, [editorRef.current?.value, fullscreen]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        editorRef.current?.focus();
      },
      insertText: (rawText: string) => {
        if (!editorRef.current) {
          return;
        }

        const prevValue = editorRef.current.value;
        const cursorPosition = editorRef.current.selectionStart;
        editorRef.current.value = prevValue.slice(0, cursorPosition) + rawText + prevValue.slice(cursorPosition);
        editorRef.current.focus();
        editorRef.current.selectionEnd = cursorPosition + rawText.length;
        handleContentChangeCallback(editorRef.current.value);
        refresh();
      },
      setContent: (text: string) => {
        if (editorRef.current) {
          editorRef.current.value = text;
          editorRef.current.focus();
          handleContentChangeCallback(editorRef.current.value);
          refresh();
        }
      },
      getContent: (): string => {
        return editorRef.current?.value ?? "";
      },
      getCursorPosition: (): number => {
        return editorRef.current?.selectionStart ?? 0;
      },
    }),
    []
  );

  const handleEditorInput = useCallback(() => {
    handleContentChangeCallback(editorRef.current?.value ?? "");
    refresh();
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
    </div>
  );
});

export default Editor;
