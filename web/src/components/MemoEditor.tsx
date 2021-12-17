import { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import appContext from "../stores/appContext";
import { globalStateService, locationService, memoService, resourceService } from "../services";
import utils from "../helpers/utils";
import { storage } from "../helpers/storage";
import toastHelper from "./Toast";
import Editor, { EditorRefActions } from "./Editor/Editor";
import "../less/memo-editor.less";

interface Props {}

const MemoEditor: React.FC<Props> = () => {
  const { globalState } = useContext(appContext);
  const editorRef = useRef<EditorRefActions>(null);
  const prevGlobalStateRef = useRef(globalState);

  useEffect(() => {
    if (globalState.markMemoId) {
      const editorCurrentValue = editorRef.current?.getContent();
      const memoLinkText = `${editorCurrentValue ? "\n" : ""}Mark: [@MEMO](${globalState.markMemoId})`;
      editorRef.current?.insertText(memoLinkText);
      globalStateService.setMarkMemoId("");
    }

    if (globalState.editMemoId && globalState.editMemoId !== prevGlobalStateRef.current.editMemoId) {
      const editMemo = memoService.getMemoById(globalState.editMemoId);
      if (editMemo) {
        editorRef.current?.setContent(editMemo.content ?? "");
        editorRef.current?.focus();
      }
    }

    prevGlobalStateRef.current = globalState;
  }, [globalState.markMemoId, globalState.editMemoId]);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const handleUploadFile = async (file: File) => {
      const { type } = file;

      if (!type.startsWith("image")) {
        return;
      }

      try {
        if (!editorRef.current) {
          return;
        }

        const image = await resourceService.upload(file);
        const url = `/r/${image.id}/${image.filename}`;

        editorRef.current.insertText(url);
      } catch (error: any) {
        toastHelper.error(error);
      }
    };

    const handlePasteEvent = async (event: ClipboardEvent) => {
      if (event.clipboardData && event.clipboardData.files.length > 0) {
        event.preventDefault();
        const file = event.clipboardData.files[0];
        handleUploadFile(file);
      }
    };

    const handleDropEvent = async (event: DragEvent) => {
      if (event.dataTransfer && event.dataTransfer.files.length > 0) {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        handleUploadFile(file);
      }
    };

    editorRef.current.element.addEventListener("paste", handlePasteEvent);
    editorRef.current.element.addEventListener("drop", handleDropEvent);

    return () => {
      editorRef.current?.element.removeEventListener("paste", handlePasteEvent);
      editorRef.current?.element.removeEventListener("drop", handleDropEvent);
    };
  }, []);

  const handleSaveBtnClick = useCallback(async (content: string) => {
    if (content === "") {
      toastHelper.error("内容不能为空呀");
      return;
    }

    const { editMemoId } = globalStateService.getState();

    content = content.replaceAll("&nbsp;", " ");

    try {
      if (editMemoId) {
        const prevMemo = memoService.getMemoById(editMemoId);

        if (prevMemo && prevMemo.content !== content) {
          const editedMemo = await memoService.updateMemo(prevMemo.id, content);
          editedMemo.updatedAt = utils.getDateTimeString(Date.now());
          memoService.editMemo(editedMemo);
        }
        globalStateService.setEditMemoId("");
      } else {
        const newMemo = await memoService.createMemo(content);
        memoService.pushMemo(newMemo);
        locationService.clearQuery();
      }
    } catch (error: any) {
      toastHelper.error(error.message);
    }

    setEditorContentCache("");
  }, []);

  const handleCancelBtnClick = useCallback(() => {
    globalStateService.setEditMemoId("");
    editorRef.current?.setContent("");
    setEditorContentCache("");
  }, []);

  const handleContentChange = useCallback((content: string) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = content;
    if (tempDiv.innerText.trim() === "") {
      content = "";
    }
    setEditorContentCache(content);
  }, []);

  const showEditStatus = Boolean(globalState.editMemoId);

  const editorConfig = useMemo(
    () => ({
      className: "memo-editor",
      initialContent: getEditorContentCache(),
      placeholder: "现在的想法是...",
      showConfirmBtn: true,
      showCancelBtn: showEditStatus,
      showTools: true,
      onConfirmBtnClick: handleSaveBtnClick,
      onCancelBtnClick: handleCancelBtnClick,
      onContentChange: handleContentChange,
    }),
    [showEditStatus]
  );

  return (
    <div className={"memo-editor-wrapper " + (showEditStatus ? "edit-ing" : "")}>
      <p className={"tip-text " + (showEditStatus ? "" : "hidden")}>正在修改中...</p>
      <Editor ref={editorRef} {...editorConfig} />
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
