import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { UNKNOWN_ID } from "../helpers/consts";
import { editorStateService, locationService, memoService, resourceService } from "../services";
import { useAppSelector } from "../store";
import * as storage from "../helpers/storage";
import useToggle from "../hooks/useToggle";
import toastHelper from "./Toast";
import Editor, { EditorRefActions } from "./Editor/Editor";
import "../less/memo-editor.less";

interface Props {}

const MemoEditor: React.FC<Props> = () => {
  const editorState = useAppSelector((state) => state.editor);
  const tags = useAppSelector((state) => state.memo.tags);
  const [isUploadingResource, setIsUploadingResource] = useToggle(false);
  const editorRef = useRef<EditorRefActions>(null);
  const prevGlobalStateRef = useRef(editorState);
  const tagSeletorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorState.markMemoId && editorState.markMemoId !== UNKNOWN_ID) {
      const editorCurrentValue = editorRef.current?.getContent();
      const memoLinkText = `${editorCurrentValue ? "\n" : ""}Mark: [@MEMO](${editorState.markMemoId})`;
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
      if (isUploadingResource) {
        return;
      }

      setIsUploadingResource(true);
      const { type } = file;

      if (!type.startsWith("image")) {
        return;
      }

      try {
        const image = await resourceService.upload(file);
        const url = `/h/r/${image.id}/${image.filename}`;

        return url;
      } catch (error: any) {
        toastHelper.error(error);
      } finally {
        setIsUploadingResource(false);
      }
    },
    [isUploadingResource]
  );

  const handleSaveBtnClick = useCallback(async (content: string) => {
    if (content === "") {
      toastHelper.error("Content can't be empty");
      return;
    }

    const { editMemoId } = editorStateService.getState();

    try {
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

    setEditorContentCache("");
  }, []);

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
      placeholder: "Any thoughts...",
      showConfirmBtn: true,
      showCancelBtn: isEditing,
      onConfirmBtnClick: handleSaveBtnClick,
      onCancelBtnClick: handleCancelBtnClick,
      onContentChange: handleContentChange,
    }),
    [isEditing]
  );

  return (
    <div className={"memo-editor-container " + (isEditing ? "edit-ing" : "")}>
      <p className={"tip-text " + (isEditing ? "" : "hidden")}>Editting...</p>
      <Editor
        ref={editorRef}
        {...editorConfig}
        tools={
          <>
            <div className="action-btn tag-action">
              <img className="icon-img" src="/icons/tag.svg" />
              <div ref={tagSeletorRef} className="tag-list" onClick={handleTagSeletorClick}>
                {tags.map((t) => {
                  return <span key={t}>{t}</span>;
                })}
              </div>
            </div>
            <div className="action-btn">
              <img className="icon-img" src="/icons/image.svg" onClick={handleUploadFileBtnClick} />
              <span className={`tip-text ${isUploadingResource ? "!block" : ""}`}>Uploading</span>
            </div>
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
