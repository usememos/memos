import React, { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import appContext from "../stores/appContext";
import { globalStateService, locationService, memoService, resourceService } from "../services";
import utils from "../helpers/utils";
import { storage } from "../helpers/storage";
import useToggle from "../hooks/useToggle";
import toastHelper from "./Toast";
import Editor, { EditorProps, EditorRefActions } from "./Editor/Editor";
import "../less/memo-editor.less";

const getCursorPostion = (input: HTMLTextAreaElement) => {
  const { offsetLeft: inputX, offsetTop: inputY, selectionEnd: selectionPoint } = input;
  const div = document.createElement("div");

  const copyStyle = window.getComputedStyle(input);
  for (const item of copyStyle) {
    div.style.setProperty(item, copyStyle.getPropertyValue(item));
  }
  div.style.position = "fixed";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";

  // we need a character that will replace whitespace when filling our dummy element if it's a single line <input/>
  const swap = ".";
  const inputValue = input.tagName === "INPUT" ? input.value.replace(/ /g, swap) : input.value;
  const textContent = inputValue.substring(0, selectionPoint || 0);
  div.textContent = textContent;
  if (input.tagName === "TEXTAREA") {
    div.style.height = "auto";
  }

  const span = document.createElement("span");
  span.textContent = inputValue.substring(selectionPoint || 0) || ".";
  div.appendChild(span);
  document.body.appendChild(div);
  const { offsetLeft: spanX, offsetTop: spanY } = span;
  document.body.removeChild(div);
  return {
    x: inputX + spanX,
    y: inputY + spanY,
  };
};

interface Props {}

const MemoEditor: React.FC<Props> = () => {
  const {
    globalState,
    memoState: { tags },
  } = useContext(appContext);
  const [isTagSeletorShown, toggleTagSeletor] = useToggle(false);
  const editorRef = useRef<EditorRefActions>(null);
  const prevGlobalStateRef = useRef(globalState);
  const tagSeletorRef = useRef<HTMLDivElement>(null);

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

    const handlePasteEvent = async (event: ClipboardEvent) => {
      if (event.clipboardData && event.clipboardData.files.length > 0) {
        event.preventDefault();
        const file = event.clipboardData.files[0];
        const url = await handleUploadFile(file);
        if (url) {
          editorRef.current?.insertText(url);
        }
      }
    };

    const handleDropEvent = async (event: DragEvent) => {
      if (event.dataTransfer && event.dataTransfer.files.length > 0) {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        const url = await handleUploadFile(file);
        if (url) {
          editorRef.current?.insertText(url);
        }
      }
    };

    const handleClickEvent = () => {
      setTimeout(() => {
        handleContentChange(editorRef.current?.element.value ?? "");
      });
    };

    const handleKeyDownEvent = () => {
      setTimeout(() => {
        handleContentChange(editorRef.current?.element.value ?? "");
      });
    };

    editorRef.current.element.addEventListener("paste", handlePasteEvent);
    editorRef.current.element.addEventListener("drop", handleDropEvent);
    editorRef.current.element.addEventListener("click", handleClickEvent);
    editorRef.current.element.addEventListener("keydown", handleKeyDownEvent);

    return () => {
      editorRef.current?.element.removeEventListener("paste", handlePasteEvent);
      editorRef.current?.element.removeEventListener("drop", handleDropEvent);
    };
  }, []);

  const handleUploadFile = useCallback(async (file: File) => {
    const { type } = file;

    if (!type.startsWith("image")) {
      return;
    }

    try {
      const image = await resourceService.upload(file);
      const url = `/r/${image.id}/${image.filename}`;

      return url;
    } catch (error: any) {
      toastHelper.error(error);
    }
  }, []);

  const handleSaveBtnClick = useCallback(async (content: string) => {
    if (content === "") {
      toastHelper.error("内容不能为空呀");
      return;
    }

    const { editMemoId } = globalStateService.getState();

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

    if (editorRef.current) {
      const currentValue = editorRef.current.getContent();
      const selectionStart = editorRef.current.element.selectionStart;
      const prevString = currentValue.slice(0, selectionStart);

      if (prevString.endsWith("#")) {
        toggleTagSeletor(true);
        updateTagSelectorPopupPosition();
      } else {
        toggleTagSeletor(false);
      }

      setTimeout(() => {
        editorRef.current?.focus();
      });
    }
  }, []);

  const handleTagTextBtnClick = useCallback(() => {
    if (!editorRef.current) {
      return;
    }

    const currentValue = editorRef.current.getContent();
    const selectionStart = editorRef.current.element.selectionStart;
    const prevString = currentValue.slice(0, selectionStart);
    const nextString = currentValue.slice(selectionStart);

    let nextValue = prevString + "# " + nextString;
    let cursorIndex = prevString.length + 1;

    if (prevString.endsWith("#") && nextString.startsWith(" ")) {
      nextValue = prevString.slice(0, prevString.length - 1) + nextString.slice(1);
      cursorIndex = prevString.length - 1;
    }

    setTimeout(() => {
      if (!editorRef.current) {
        return;
      }

      editorRef.current.element.value = nextValue;
      editorRef.current.element.setSelectionRange(cursorIndex, cursorIndex);
      editorRef.current.focus();
      handleContentChange(editorRef.current.element.value);
    });
  }, []);

  const updateTagSelectorPopupPosition = useCallback(() => {
    if (!editorRef.current || !tagSeletorRef.current) {
      return;
    }

    const { x, y } = getCursorPostion(editorRef.current.element);
    if (x + 128 + 16 > editorRef.current.element.clientWidth) {
      tagSeletorRef.current.style.left = `${editorRef.current.element.clientWidth + 20 - 128}px`;
    } else {
      tagSeletorRef.current.style.left = `${x + 2}px`;
    }
    tagSeletorRef.current.style.top = `${y + 32 + 6}px`;
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
        editorRef.current?.insertText(url);
      }
    };
    inputEl.click();
  }, []);

  const handleTagSeletorClick = useCallback((event: React.MouseEvent) => {
    if (tagSeletorRef.current !== event.target && tagSeletorRef.current?.contains(event.target as Node)) {
      editorRef.current?.insertText((event.target as HTMLElement).textContent ?? "");
    }
  }, []);

  const showEditStatus = Boolean(globalState.editMemoId);

  const editorConfig: EditorProps = useMemo(
    () => ({
      className: "memo-editor",
      initialContent: getEditorContentCache(),
      placeholder: "现在的想法是...",
      showConfirmBtn: true,
      showCancelBtn: showEditStatus,
      showTools: true,
      onConfirmBtnClick: handleSaveBtnClick,
      onCancelBtnClick: handleCancelBtnClick,
      onTagTextBtnClick: handleTagTextBtnClick,
      onUploadFileBtnClick: handleUploadFileBtnClick,
      onContentChange: handleContentChange,
    }),
    [showEditStatus]
  );

  return (
    <div className={"memo-editor-wrapper " + (showEditStatus ? "edit-ing" : "")}>
      <p className={"tip-text " + (showEditStatus ? "" : "hidden")}>正在修改中...</p>
      <Editor ref={editorRef} {...editorConfig} />
      <div
        ref={tagSeletorRef}
        className={`tag-list ${isTagSeletorShown && tags.length > 0 ? "" : "hidden"}`}
        onClick={handleTagSeletorClick}
      >
        {tags.map((t) => {
          return <span key={t}>{t}</span>;
        })}
      </div>
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
