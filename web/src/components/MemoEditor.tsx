import { isNumber, last, toLower } from "lodash";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { deleteMemoResource, upsertMemoResource } from "../helpers/api";
import { TAB_SPACE_WIDTH, UNKNOWN_ID, VISIBILITY_SELECTOR_ITEMS } from "../helpers/consts";
import { editorStateService, locationService, memoService, resourceService } from "../services";
import { useAppSelector } from "../store";
import * as storage from "../helpers/storage";
import Icon from "./Icon";
import toastHelper from "./Toast";
import Selector from "./common/Selector";
import Editor, { EditorRefActions } from "./Editor/Editor";
import ResourceIcon from "./ResourceIcon";
import showResourcesSelectorDialog from "./ResourcesSelectorDialog";
import "../less/memo-editor.less";

const listItemSymbolList = ["- [ ] ", "- [x] ", "- [X] ", "* ", "- "];
const emptyOlReg = /^(\d+)\. $/;

const getEditorContentCache = (): string => {
  return storage.get(["editorContentCache"]).editorContentCache ?? "";
};

const setEditorContentCache = (content: string) => {
  storage.set({
    editorContentCache: content,
  });
};

const setEditingMemoVisibilityCache = (visibility: Visibility) => {
  storage.set({
    editingMemoVisibilityCache: visibility,
  });
};

interface State {
  fullscreen: boolean;
  isUploadingResource: boolean;
  shouldShowEmojiPicker: boolean;
}

const MemoEditor = () => {
  const { t, i18n } = useTranslation();
  const user = useAppSelector((state) => state.user.user as User);
  const setting = user.setting;
  const editorState = useAppSelector((state) => state.editor);
  const tags = useAppSelector((state) => state.memo.tags);
  const [state, setState] = useState<State>({
    isUploadingResource: false,
    fullscreen: false,
    shouldShowEmojiPicker: false,
  });
  const [allowSave, setAllowSave] = useState<boolean>(false);
  const prevEditorStateRef = useRef(editorState);
  const editorRef = useRef<EditorRefActions>(null);
  const tagSelectorRef = useRef<HTMLDivElement>(null);
  const memoVisibilityOptionSelectorItems = VISIBILITY_SELECTOR_ITEMS.map((item) => {
    return {
      value: item.value,
      text: t(`memo.visibility.${toLower(item.value)}`),
    };
  });

  useEffect(() => {
    const { editingMemoIdCache, editingMemoVisibilityCache } = storage.get(["editingMemoIdCache", "editingMemoVisibilityCache"]);
    if (editingMemoIdCache) {
      editorStateService.setEditMemoWithId(editingMemoIdCache);
    }
    if (editingMemoVisibilityCache) {
      editorStateService.setMemoVisibility(editingMemoVisibilityCache as "PUBLIC" | "PROTECTED" | "PRIVATE");
    } else {
      editorStateService.setMemoVisibility(setting.memoVisibility);
    }
  }, []);

  useEffect(() => {
    if (editorState.editMemoId) {
      memoService.getMemoById(editorState.editMemoId ?? UNKNOWN_ID).then((memo) => {
        if (memo) {
          handleEditorFocus();
          editorStateService.setMemoVisibility(memo.visibility);
          editorStateService.setResourceList(memo.resourceList);
          editorRef.current?.setContent(memo.content ?? "");
        }
      });
      storage.set({
        editingMemoIdCache: editorState.editMemoId,
      });
    } else {
      storage.remove(["editingMemoIdCache"]);
    }

    prevEditorStateRef.current = editorState;
  }, [editorState.editMemoId]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!editorRef.current) {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      if (event.key === "Enter") {
        handleSaveBtnClick();
        return;
      }
      if (event.key === "b") {
        event.preventDefault();
        editorRef.current.insertText("", "**", "**");
        return;
      }
      if (event.key === "i") {
        event.preventDefault();
        editorRef.current.insertText("", "*", "*");
        return;
      }
      if (event.key === "e") {
        event.preventDefault();
        editorRef.current.insertText("", "`", "`");
        return;
      }
    }

    if (event.key === "Enter") {
      const cursorPosition = editorRef.current.getCursorPosition();
      const contentBeforeCursor = editorRef.current.getContent().slice(0, cursorPosition);
      const rowValue = last(contentBeforeCursor.split("\n"));
      if (rowValue) {
        if (listItemSymbolList.includes(rowValue) || emptyOlReg.test(rowValue)) {
          event.preventDefault();
          editorRef.current.removeText(cursorPosition - rowValue.length, rowValue.length);
        } else {
          // unordered/todo list
          let matched = false;
          for (const listItemSymbol of listItemSymbolList) {
            if (rowValue.startsWith(listItemSymbol)) {
              event.preventDefault();
              editorRef.current.insertText("", `\n${listItemSymbol}`);
              matched = true;
              break;
            }
          }

          if (!matched) {
            // ordered list
            const olMatchRes = /^(\d+)\. /.exec(rowValue);
            if (olMatchRes) {
              const order = parseInt(olMatchRes[1]);
              if (isNumber(order)) {
                event.preventDefault();
                editorRef.current.insertText("", `\n${order + 1}. `);
              }
            }
          }
        }
      }
      return;
    }
    if (event.key === "Escape") {
      if (state.fullscreen) {
        handleFullscreenBtnClick();
      }
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      editorRef.current.insertText(" ".repeat(TAB_SPACE_WIDTH));
      return;
    }
  };

  const uploadMultiFiles = async (files: FileList) => {
    const uploadedResourceList: Resource[] = [];
    for (const file of files) {
      const resource = await handleUploadResource(file);
      if (resource) {
        uploadedResourceList.push(resource);
        if (editorState.editMemoId) {
          await upsertMemoResource(editorState.editMemoId, resource.id);
        }
      }
    }
    if (uploadedResourceList.length > 0) {
      const resourceList = editorStateService.getState().resourceList;
      editorStateService.setResourceList([...resourceList, ...uploadedResourceList]);
    }
  };

  const handleDropEvent = async (event: React.DragEvent) => {
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      event.preventDefault();
      await uploadMultiFiles(event.dataTransfer.files);
    }
  };

  const handlePasteEvent = async (event: React.ClipboardEvent) => {
    if (event.clipboardData && event.clipboardData.files.length > 0) {
      event.preventDefault();
      await uploadMultiFiles(event.clipboardData.files);
    }
  };

  const handleUploadResource = async (file: File) => {
    setState((state) => {
      return {
        ...state,
        isUploadingResource: true,
      };
    });

    let resource = undefined;

    try {
      resource = await resourceService.upload(file);
    } catch (error: any) {
      console.error(error);
      toastHelper.error(error.response.data.message);
    }

    setState((state) => {
      return {
        ...state,
        isUploadingResource: false,
      };
    });
    return resource;
  };

  const handleSaveBtnClick = async () => {
    const content = editorRef.current?.getContent();
    if (!content) {
      toastHelper.error(t("editor.cant-empty"));
      return;
    }

    try {
      const { editMemoId } = editorStateService.getState();
      if (editMemoId && editMemoId !== UNKNOWN_ID) {
        const prevMemo = await memoService.getMemoById(editMemoId ?? UNKNOWN_ID);

        if (prevMemo) {
          await memoService.patchMemo({
            id: prevMemo.id,
            content,
            visibility: editorState.memoVisibility,
            resourceIdList: editorState.resourceList.map((resource) => resource.id),
          });
        }
        editorStateService.clearEditMemo();
      } else {
        await memoService.createMemo({
          content,
          visibility: editorState.memoVisibility,
          resourceIdList: editorState.resourceList.map((resource) => resource.id),
        });
        locationService.clearQuery();
      }
    } catch (error: any) {
      console.error(error);
      toastHelper.error(error.response.data.message);
    }

    setState((state) => {
      return {
        ...state,
        fullscreen: false,
      };
    });
    editorStateService.clearResourceList();
    setEditorContentCache("");
    storage.remove(["editingMemoVisibilityCache"]);
    editorRef.current?.setContent("");
  };

  const handleCancelEdit = () => {
    if (editorState.editMemoId) {
      editorStateService.clearEditMemo();
      editorStateService.clearResourceList();
      editorRef.current?.setContent("");
      setEditorContentCache("");
      storage.remove(["editingMemoVisibilityCache"]);
    }
  };

  const handleContentChange = (content: string) => {
    setAllowSave(content !== "");
    setEditorContentCache(content);
  };

  const handleCheckBoxBtnClick = () => {
    if (!editorRef.current) {
      return;
    }

    const cursorPosition = editorRef.current.getCursorPosition();
    const prevValue = editorRef.current.getContent().slice(0, cursorPosition);
    if (prevValue === "" || prevValue.endsWith("\n")) {
      editorRef.current?.insertText("", "- [ ] ");
    } else {
      editorRef.current?.insertText("", "\n- [ ] ");
    }
  };

  const handleCodeBlockBtnClick = () => {
    if (!editorRef.current) {
      return;
    }

    const cursorPosition = editorRef.current.getCursorPosition();
    const prevValue = editorRef.current.getContent().slice(0, cursorPosition);
    if (prevValue === "" || prevValue.endsWith("\n")) {
      editorRef.current?.insertText("", "```\n", "\n```");
    } else {
      editorRef.current?.insertText("", "\n```\n", "\n```");
    }
  };

  const handleUploadFileBtnClick = () => {
    const inputEl = document.createElement("input");
    inputEl.style.position = "fixed";
    inputEl.style.top = "-100vh";
    inputEl.style.left = "-100vw";
    document.body.appendChild(inputEl);
    inputEl.type = "file";
    inputEl.multiple = true;
    inputEl.accept = "*";
    inputEl.onchange = async () => {
      if (!inputEl.files || inputEl.files.length === 0) {
        return;
      }

      const resourceList: Resource[] = [];
      for (const file of inputEl.files) {
        const resource = await handleUploadResource(file);
        if (resource) {
          resourceList.push(resource);
          if (editorState.editMemoId) {
            await upsertMemoResource(editorState.editMemoId, resource.id);
          }
        }
      }
      editorStateService.setResourceList([...editorState.resourceList, ...resourceList]);
      document.body.removeChild(inputEl);
    };
    inputEl.click();
  };

  const handleFullscreenBtnClick = () => {
    setState((state) => {
      return {
        ...state,
        fullscreen: !state.fullscreen,
      };
    });
  };

  const handleTagSelectorClick = useCallback((event: React.MouseEvent) => {
    if (tagSelectorRef.current !== event.target && tagSelectorRef.current?.contains(event.target as Node)) {
      editorRef.current?.insertText(`#${(event.target as HTMLElement).textContent} ` ?? "");
      handleEditorFocus();
    }
  }, []);

  const handleDeleteResource = async (resourceId: ResourceId) => {
    editorStateService.setResourceList(editorState.resourceList.filter((resource) => resource.id !== resourceId));
    if (editorState.editMemoId) {
      await deleteMemoResource(editorState.editMemoId, resourceId);
    }
  };

  const handleMemoVisibilityOptionChanged = async (value: string) => {
    const visibilityValue = value as Visibility;
    editorStateService.setMemoVisibility(visibilityValue);
    setEditingMemoVisibilityCache(visibilityValue);
  };

  const handleEditorFocus = () => {
    editorRef.current?.focus();
  };

  const handleEditorBlur = () => {
    // do nothing
  };

  const isEditing = Boolean(editorState.editMemoId && editorState.editMemoId !== UNKNOWN_ID);

  const editorConfig = useMemo(
    () => ({
      className: `memo-editor`,
      initialContent: getEditorContentCache(),
      placeholder: t("editor.placeholder"),
      fullscreen: state.fullscreen,
      onContentChange: handleContentChange,
      onPaste: handlePasteEvent,
    }),
    [state.fullscreen, i18n.language]
  );

  return (
    <div
      className={`memo-editor-container ${isEditing ? "edit-ing" : ""} ${state.fullscreen ? "fullscreen" : ""}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onDrop={handleDropEvent}
      onFocus={handleEditorFocus}
      onBlur={handleEditorBlur}
    >
      <Editor ref={editorRef} {...editorConfig} />
      <div className="common-tools-wrapper">
        <div className="common-tools-container">
          <div className="action-btn tag-action">
            <Icon.Hash className="icon-img" />
            <div ref={tagSelectorRef} className="tag-list" onClick={handleTagSelectorClick}>
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
            <Icon.CheckSquare className="icon-img" onClick={handleCheckBoxBtnClick} />
          </button>
          <button className="action-btn">
            <Icon.Code className="icon-img" onClick={handleCodeBlockBtnClick} />
          </button>
          <div className="action-btn resource-btn">
            <Icon.FileText className="icon-img" />
            <span className={`tip-text ${state.isUploadingResource ? "!block" : ""}`}>Uploading</span>
            <div className="resource-action-list">
              <div className="resource-action-item" onClick={handleUploadFileBtnClick}>
                <Icon.Upload className="icon-img" />
                <span>{t("editor.local")}</span>
              </div>
              <div className="resource-action-item" onClick={showResourcesSelectorDialog}>
                <Icon.Database className="icon-img" />
                <span>{t("editor.resources")}</span>
              </div>
            </div>
          </div>
          <button className="action-btn" onClick={handleFullscreenBtnClick}>
            {state.fullscreen ? <Icon.Minimize className="icon-img" /> : <Icon.Maximize className="icon-img" />}
          </button>
        </div>
      </div>
      {editorState.resourceList && editorState.resourceList.length > 0 && (
        <div className="resource-list-wrapper">
          {editorState.resourceList.map((resource) => {
            return (
              <div key={resource.id} className="resource-container">
                <ResourceIcon resourceType="resource.type" className="icon-img" />
                <span className="name-text">{resource.filename}</span>
                <Icon.X className="close-icon" onClick={() => handleDeleteResource(resource.id)} />
              </div>
            );
          })}
        </div>
      )}
      <div className="editor-footer-container">
        <Selector
          className="visibility-selector"
          value={editorState.memoVisibility}
          dataSource={memoVisibilityOptionSelectorItems}
          handleValueChanged={handleMemoVisibilityOptionChanged}
        />
        <div className="buttons-container">
          <button className={`action-btn cancel-btn ${isEditing ? "" : "!hidden"}`} onClick={handleCancelEdit}>
            {t("editor.cancel-edit")}
          </button>
          <button className="action-btn confirm-btn" disabled={!allowSave || state.isUploadingResource} onClick={handleSaveBtnClick}>
            {t("editor.save")}
            <img className="icon-img w-4 h-auto" src="/logo.webp" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemoEditor;
