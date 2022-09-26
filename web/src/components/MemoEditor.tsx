import { IEmojiData } from "emoji-picker-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { UNKNOWN_ID } from "../helpers/consts";
import { editorStateService, locationService, memoService, resourceService } from "../services";
import { useAppSelector } from "../store";
import * as storage from "../helpers/storage";
import Icon from "./Icon";
import toastHelper from "./Toast";
import Editor, { EditorRefActions } from "./Editor/Editor";
import EmojiPicker from "./Editor/EmojiPicker";
import "../less/memo-editor.less";

const getEditorContentCache = (): string => {
  return storage.get(["editorContentCache"]).editorContentCache ?? "";
};

const setEditorContentCache = (content: string) => {
  storage.set({
    editorContentCache: content,
  });
};

interface State {
  fullscreen: boolean;
  isUploadingResource: boolean;
  shouldShowEmojiPicker: boolean;
}

const MemoEditor: React.FC = () => {
  const { t, i18n } = useTranslation();
  const user = useAppSelector((state) => state.user.user);
  const editorState = useAppSelector((state) => state.editor);
  const tags = useAppSelector((state) => state.memo.tags);
  const [state, setState] = useState<State>({
    isUploadingResource: false,
    fullscreen: false,
    shouldShowEmojiPicker: false,
  });
  const editorRef = useRef<EditorRefActions>(null);
  const prevGlobalStateRef = useRef(editorState);
  const tagSeletorRef = useRef<HTMLDivElement>(null);
  const editorFontStyle = user?.setting.editorFontStyle || "normal";
  const mobileEditorStyle = user?.setting.mobileEditorStyle || "normal";

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
        toastHelper.error(t("editor.only-image-supported"));
        return;
      }

      try {
        const image = await resourceService.upload(file);
        const url = `/o/r/${image.id}/${image.filename}`;
        return url;
      } catch (error: any) {
        console.error(error);
        toastHelper.error(error.response.data.message);
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
      toastHelper.error(t("editor.cant-empty"));
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
      console.error(error);
      toastHelper.error(error.response.data.message);
    }

    setState({
      ...state,
      fullscreen: false,
    });
    setEditorContentCache("");
  };

  const handleCancelEditingBtnClick = useCallback(() => {
    editorStateService.clearEditMemo();
    editorRef.current?.setContent("");
    setEditorContentCache("");
  }, []);

  const handleContentChange = useCallback((content: string) => {
    setEditorContentCache(content);
  }, []);

  const handleEmojiPickerBtnClick = () => {
    handleChangeShouldShowEmojiPicker(!state.shouldShowEmojiPicker);
  };

  const handleCheckBoxBtnClick = () => {
    if (!editorRef.current) {
      return;
    }

    const cursorPosition = editorRef.current.getCursorPosition();
    const prevValue = editorRef.current.getContent().slice(0, cursorPosition);
    if (prevValue === "" || prevValue.endsWith("\n")) {
      editorRef.current?.insertText("- [ ] ");
    } else {
      editorRef.current?.insertText("\n- [ ] ");
    }
  };

  const handleCodeBlockBtnClick = () => {
    if (!editorRef.current) {
      return;
    }

    const cursorPosition = editorRef.current.getCursorPosition();
    const prevValue = editorRef.current.getContent().slice(0, cursorPosition);
    if (prevValue === "" || prevValue.endsWith("\n")) {
      editorRef.current?.insertText("```\n\n```");
    } else {
      editorRef.current?.insertText("\n```\n\n```");
    }
  };

  const handleUploadFileBtnClick = useCallback(() => {
    const inputEl = document.createElement("input");
    inputEl.style.position = "fixed";
    inputEl.style.top = "-100vh";
    inputEl.style.left = "-100vw";
    document.body.appendChild(inputEl);
    inputEl.type = "file";
    inputEl.multiple = true;
    inputEl.accept = "image/*";
    inputEl.onchange = async () => {
      if (!inputEl.files || inputEl.files.length === 0) {
        return;
      }

      for (const file of inputEl.files) {
        const url = await handleUploadFile(file);
        if (url) {
          editorRef.current?.insertText(`![](${url})`);
        }
      }
      document.body.removeChild(inputEl);
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

  const handleChangeShouldShowEmojiPicker = (status: boolean) => {
    setState({
      ...state,
      shouldShowEmojiPicker: status,
    });
  };

  const handleEmojiClick = (_: any, emojiObject: IEmojiData) => {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.insertText(`${emojiObject.emoji}`);
    handleChangeShouldShowEmojiPicker(false);
  };

  const isEditing = Boolean(editorState.editMemoId && editorState.editMemoId !== UNKNOWN_ID);

  const editorConfig = useMemo(
    () => ({
      className: `memo-editor ${editorFontStyle}`,
      initialContent: getEditorContentCache(),
      placeholder: t("editor.placeholder"),
      fullscreen: state.fullscreen,
      showConfirmBtn: true,
      onConfirmBtnClick: handleSaveBtnClick,
      onContentChange: handleContentChange,
    }),
    [isEditing, state.fullscreen, i18n.language, editorFontStyle]
  );

  return (
    <div className={`memo-editor-container ${mobileEditorStyle} ${isEditing ? "edit-ing" : ""} ${state.fullscreen ? "fullscreen" : ""}`}>
      <div className={`tip-container ${isEditing ? "" : "!hidden"}`}>
        <span className="tip-text">{t("editor.editing")}</span>
        <button className="cancel-btn" onClick={handleCancelEditingBtnClick}>
          {t("common.cancel")}
        </button>
      </div>
      <Editor
        ref={editorRef}
        {...editorConfig}
        tools={
          <>
            <div className="action-btn tag-action">
              <Icon.Hash className="icon-img" />
              <div ref={tagSeletorRef} className="tag-list" onClick={handleTagSeletorClick}>
                {tags.length > 0 ? (
                  tags.map((tag) => {
                    return (
                      <span className="item-container" key={tag}>
                        {tag}
                      </span>
                    );
                  })
                ) : (
                  <p className="tip-text" onClick={(e) => e.stopPropagation()}>
                    {t("common.null")}
                  </p>
                )}
              </div>
            </div>
            <button className="action-btn">
              <Icon.Smile className="icon-img" onClick={handleEmojiPickerBtnClick} />
            </button>
            <button className="action-btn">
              <Icon.CheckSquare className="icon-img" onClick={handleCheckBoxBtnClick} />
            </button>
            <button className="action-btn">
              <Icon.Code className="icon-img" onClick={handleCodeBlockBtnClick} />
            </button>
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
      <EmojiPicker
        shouldShow={state.shouldShowEmojiPicker}
        onEmojiClick={handleEmojiClick}
        onShouldShowEmojiPickerChange={handleChangeShouldShowEmojiPicker}
      />
    </div>
  );
};

export default MemoEditor;
