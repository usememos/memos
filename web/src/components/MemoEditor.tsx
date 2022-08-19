import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UNKNOWN_ID } from "../helpers/consts";
import { editorStateService, locationService, memoService, resourceService } from "../services";
import useI18n from "../hooks/useI18n";
import { useAppSelector } from "../store";
import * as storage from "../helpers/storage";
import Icon from "./Icon";
import toastHelper from "./Toast";
import Editor, { EditorRefActions } from "./Editor/Editor";
import "../less/memo-editor.less";

interface Props {}

interface State {
  isUploadingResource: boolean;
  fullscreen: boolean;
}

const MemoEditor: React.FC<Props> = () => {
  const { t, locale } = useI18n();
  const editorState = useAppSelector((state) => state.editor);
  const tags = useAppSelector((state) => state.memo.tags);
  const [state, setState] = useState<State>({
    isUploadingResource: false,
    fullscreen: false,
  });
  const editorRef = useRef<EditorRefActions>(null);
  const prevGlobalStateRef = useRef(editorState);
  const tagSeletorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorState.markMemoId && editorState.markMemoId !== UNKNOWN_ID) {
      const editorCurrentValue = editorRef.current?.getContent();
      const memoLinkText = `${editorCurrentValue ? "\n" : ""}Mark: @[MEMO](${editorState.markMemoId})`;
      editorRef.current?.insertText(memoLinkText);
      editorStateService.clearMarkMemo();
    }

    if (
      editorState.editMemoId &&
      editorState.editMemoId !== UNKNOWN_ID &&
      editorState.editMemoId !== prevGlobalStateRef.current.editMemoId
    ) {
      const editMemo = memoService.getMemoById(editorState.editMemoId ?? UNKNOWN_ID);
      if (editMemo) {
        editorRef.current?.setContent(editMemo.content ?? "");
        editorRef.current?.focus();
      }
    }

    prevGlobalStateRef.current = editorState;
  }, [editorState.markMemoId, editorState.editMemoId]);

  useEffect(() => {
    const handlePasteEvent = async (event: ClipboardEvent) => {
      if (event.clipboardData && event.clipboardData.files.length > 0) {
        event.preventDefault();
        const file = event.clipboardData.files[0];
        const url = await handleUploadFile(file);
        if (url) {
          editorRef.current?.insertText(`![](${url})`);
        }
      }
    };

    const handleDropEvent = async (event: DragEvent) => {
      if (event.dataTransfer && event.dataTransfer.files.length > 0) {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        const url = await handleUploadFile(file);
        if (url) {
          editorRef.current?.insertText(`![](${url})`);
        }
      }
    };

    const handleClickEvent = () => {
      handleContentChange(editorRef.current?.element.value ?? "");
    };

    const handleKeyDownEvent = () => {
      setTimeout(() => {
        handleContentChange(editorRef.current?.element.value ?? "");
      });
    };

    editorRef.current?.element.addEventListener("paste", handlePasteEvent);
    editorRef.current?.element.addEventListener("drop", handleDropEvent);
    editorRef.current?.element.addEventListener("click", handleClickEvent);
    editorRef.current?.element.addEventListener("keydown", handleKeyDownEvent);

    return () => {
      editorRef.current?.element.removeEventListener("paste", handlePasteEvent);
      editorRef.current?.element.removeEventListener("drop", handleDropEvent);
      editorRef.current?.element.removeEventListener("click", handleClickEvent);
      editorRef.current?.element.removeEventListener("keydown", handleKeyDownEvent);
    };
  }, []);

  const handleUploadFile = useCallback(
    async (file: File) => {
      if (state.isUploadingResource) {
        return;
      }

      setState({
        ...state,
        isUploadingResource: true,
      });
      const { type } = file;

      if (!type.startsWith("image")) {
        toastHelper.error("Only image file supported.");
        return;
      }

      try {
        const image = await resourceService.upload(file);
        const url = `/h/r/${image.id}/${image.filename}`;
        return url;
      } catch (error: any) {
        toastHelper.error("Failed to upload image\n" + JSON.stringify(error, null, 4));
      } finally {
        setState({
          ...state,
          isUploadingResource: false,
        });
      }
    },
    [state]
  );

  const handleSaveBtnClick = async (content: string) => {
    if (content === "") {
      toastHelper.error("Content can't be empty");
      return;
    }

    try {
      const { editMemoId } = editorStateService.getState();
      if (editMemoId && editMemoId !== UNKNOWN_ID) {
        const prevMemo = memoService.getMemoById(editMemoId ?? UNKNOWN_ID);

        if (prevMemo && prevMemo.content !== content) {
          await memoService.patchMemo({
            id: prevMemo.id,
            content,
          });
        }
        editorStateService.clearEditMemo();
      } else {
        await memoService.createMemo({
          content,
        });
        locationService.clearQuery();
      }
    } catch (error: any) {
      toastHelper.error(error.message);
    }

    setState({
      ...state,
      fullscreen: false,
    });
    setEditorContentCache("");
  };

  const handleCancelBtnClick = useCallback(() => {
    editorStateService.clearEditMemo();
    editorRef.current?.setContent("");
    setEditorContentCache("");
  }, []);

  const handleContentChange = useCallback((content: string) => {
    setEditorContentCache(content);
  }, []);

  const handleUploadFileBtnClick = useCallback(() => {
    const inputEl = document.createElement("input");
    inputEl.type = "file";
    inputEl.multiple = false;
    inputEl.accept = "image/png, image/gif, image/jpeg";
    inputEl.onchange = async () => {
      if (!inputEl.files || inputEl.files.length === 0) {
        return;
      }

      const file = inputEl.files[0];
      const url = await handleUploadFile(file);
      if (url) {
        editorRef.current?.insertText(`![](${url})`);
      }
    };
    inputEl.click();
  }, []);

  const handleFullscreenBtnClick = () => {
    setState({
      ...state,
      fullscreen: !state.fullscreen,
    });
  };

  const handleTagSeletorClick = useCallback((event: React.MouseEvent) => {
    if (tagSeletorRef.current !== event.target && tagSeletorRef.current?.contains(event.target as Node)) {
      editorRef.current?.insertText(`#${(event.target as HTMLElement).textContent} ` ?? "");
      editorRef.current?.focus();
    }
  }, []);

  const isEditing = Boolean(editorState.editMemoId && editorState.editMemoId !== UNKNOWN_ID);

  const editorConfig = useMemo(
    () => ({
      className: "memo-editor",
      initialContent: getEditorContentCache(),
      placeholder: t("editor.placeholder"),
      fullscreen: state.fullscreen,
      showConfirmBtn: true,
      showCancelBtn: isEditing,
      onConfirmBtnClick: handleSaveBtnClick,
      onCancelBtnClick: handleCancelBtnClick,
      onContentChange: handleContentChange,
    }),
    [isEditing, state.fullscreen, locale]
  );

  return (
    <div className={`memo-editor-container ${isEditing ? "edit-ing" : ""} ${state.fullscreen ? "fullscreen" : ""}`}>
      <p className={"tip-text " + (isEditing ? "" : "hidden")}>Editting...</p>
      <Editor
        ref={editorRef}
        {...editorConfig}
        tools={
          <>
            <div className="action-btn tag-action">
              <Icon.Hash className="icon-img" />
              <div ref={tagSeletorRef} className="tag-list" onClick={handleTagSeletorClick}>
                {tags.map((t) => {
                  return <span key={t}>{t}</span>;
                })}
              </div>
            </div>
            <button className="action-btn">
              <Icon.Image className="icon-img" onClick={handleUploadFileBtnClick} />
              <span className={`tip-text ${state.isUploadingResource ? "!block" : ""}`}>Uploading</span>
            </button>
            <button className="action-btn" onClick={handleFullscreenBtnClick}>
              {state.fullscreen ? <Icon.Minimize className="icon-img" /> : <Icon.Maximize className="icon-img" />}
            </button>
          </>
        }
      />
    </div>
  );
};

function getEditorContentCache(): string {
  return storage.get(["editorContentCache"]).editorContentCache ?? "";
}

function setEditorContentCache(content: string) {
  storage.set({
    editorContentCache: content,
  });
}

export default MemoEditor;
