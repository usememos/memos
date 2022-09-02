import { forwardRef, ReactNode, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import useI18n from "../../hooks/useI18n";
import useRefresh from "../../hooks/useRefresh";
import Only from "../common/OnlyWhen";
import "../../less/editor.less";

export interface EditorRefActions {
  element: HTMLTextAreaElement;
  focus: FunctionType;
  insertText: (text: string) => void;
  setContent: (text: string) => void;
  getContent: () => string;
  getCursorPosition: () => number;
}

interface EditorProps {
  className: string;
  initialContent: string;
  placeholder: string;
  fullscreen: boolean;
  showConfirmBtn: boolean;
  tools?: ReactNode;
  onConfirmBtnClick: (content: string) => void;
  onContentChange: (content: string) => void;
}

// eslint-disable-next-line react/display-name
const Editor = forwardRef((props: EditorProps, ref: React.ForwardedRef<EditorRefActions>) => {
  const {
    className,
    initialContent,
    placeholder,
    fullscreen,
    showConfirmBtn,
    onConfirmBtnClick: handleConfirmBtnClickCallback,
    onContentChange: handleContentChangeCallback,
  } = props;
  const { t } = useI18n();
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const refresh = useRefresh();

  useEffect(() => {
    if (editorRef.current && initialContent) {
      editorRef.current.value = initialContent;
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
      element: editorRef.current as HTMLTextAreaElement,
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

  const handleEditorKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation();

    if (event.code === "Enter") {
      if (event.metaKey || event.ctrlKey) {
        handleCommonConfirmBtnClick();
      }
    }
  }, []);

  const handleCommonConfirmBtnClick = useCallback(() => {
    if (!editorRef.current) {
      return;
    }

    handleConfirmBtnClickCallback(editorRef.current.value);
    editorRef.current.value = "";
  }, []);

  return (
    <div className={"common-editor-wrapper " + className}>
      <textarea
        className="common-editor-inputer"
        rows={1}
        placeholder={placeholder}
        ref={editorRef}
        onInput={handleEditorInput}
        onKeyDown={handleEditorKeyDown}
      ></textarea>
      <div className="common-tools-wrapper">
        <div className="common-tools-container">
          <Only when={props.tools !== undefined}>{props.tools}</Only>
        </div>
        <div className="btns-container">
          <Only when={showConfirmBtn}>
            <button className="action-btn confirm-btn" disabled={editorRef.current?.value === ""} onClick={handleCommonConfirmBtnClick}>
              {t("editor.save")} <span className="icon-text">✍️</span>
            </button>
          </Only>
        </div>
      </div>
    </div>
  );
});

export default Editor;
