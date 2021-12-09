import { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import appContext from "../stores/appContext";
import { globalStateService, locationService, memoService } from "../services";
import utils from "../helpers/utils";
import { storage } from "../helpers/storage";
import toastHelper from "./Toast";
import Editor, { EditorRefActions } from "./Editor/Editor";
import "../less/memo-editor.less";

interface Props {
  className?: string;
  editMemoId?: string;
}

const MemoEditor: React.FC<Props> = (props: Props) => {
  const { className, editMemoId } = props;
  const { globalState } = useContext(appContext);
  const editorRef = useRef<EditorRefActions>(null);

  useEffect(() => {
    if (globalState.markMemoId) {
      if (editMemoId === globalState.editMemoId || (!editMemoId && !globalState.editMemoId)) {
        const editorCurrentValue = editorRef.current?.getContent();
        const memoLinkText = `${editorCurrentValue ? "\n" : ""}Mark: [@MEMO](${globalState.markMemoId})`;
        editorRef.current?.insertText(memoLinkText);
        globalStateService.setMarkMemoId("");
      }
    }
  }, [globalState.markMemoId]);

  useEffect(() => {
    if (editMemoId) {
      const editMemo = memoService.getMemoById(editMemoId);
      if (editMemo) {
        editorRef.current?.setContent(editMemo.content ?? "");
        editorRef.current?.focus();
      }
    }
  }, [editMemoId]);

  const handleSaveBtnClick = useCallback(async (content: string) => {
    if (content === "") {
      toastHelper.error("内容不能为空呀");
      return;
    }

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

  const showEditStatus = Boolean(editMemoId);

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
    [editMemoId]
  );

  return (
    <div className={`memo-editor-wrapper ${className} ${editMemoId ? "edit-ing" : ""}`}>
      <p className={"tip-text " + (editMemoId ? "" : "hidden")}>正在修改中...</p>
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
