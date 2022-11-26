import { IEmojiData } from "emoji-picker-react";
import { toLower } from "lodash";
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
import EmojiPicker from "./Editor/EmojiPicker";
import ResourceIcon from "./ResourceIcon";
import "../less/memo-editor.less";

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
  resourceList: Resource[];
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
    resourceList: [],
  });
  const [allowSave, setAllowSave] = useState<boolean>(false);
  const prevGlobalStateRef = useRef(editorState);
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
          editorRef.current?.setContent(memo.content ?? "");
          setState((state) => {
            return {
              ...state,
              resourceList: memo.resourceList,
            };
          });
        }
      });
      storage.set({
        editingMemoIdCache: editorState.editMemoId,
      });
    } else {
      storage.remove(["editingMemoIdCache"]);
    }

    prevGlobalStateRef.current = editorState;
  }, [editorState.editMemoId]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      if (state.fullscreen) {
        handleFullscreenBtnClick();
      } else {
        handleCancelEdit();
      }
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      editorRef.current?.insertText(" ".repeat(TAB_SPACE_WIDTH));
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      if (event.key === "Enter") {
        handleSaveBtnClick();
        return;
      }
      if (event.key === "b") {
        event.preventDefault();
        editorRef.current?.insertText("", "**", "**");
        return;
      }
      if (event.key === "i") {
        event.preventDefault();
        editorRef.current?.insertText("", "*", "*");
        return;
      }
      if (event.key === "e") {
        event.preventDefault();
        editorRef.current?.insertText("", "`", "`");
        return;
      }
    }
  };

  const handleDropEvent = async (event: React.DragEvent) => {
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      event.preventDefault();
      const resourceList: Resource[] = [];
      for (const file of event.dataTransfer.files) {
        const resource = await handleUploadResource(file);
        if (resource) {
          resourceList.push(resource);
          if (editorState.editMemoId) {
            await upsertMemoResource(editorState.editMemoId, resource.id);
          }
        }
      }
      setState((state) => {
        return {
          ...state,
          resourceList: [...state.resourceList, ...resourceList],
        };
      });
    }
  };

  const handlePasteEvent = async (event: React.ClipboardEvent) => {
    if (event.clipboardData && event.clipboardData.files.length > 0) {
      event.preventDefault();
      const file = event.clipboardData.files[0];
      const resource = await handleUploadResource(file);
      if (resource) {
        setState((state) => {
          return {
            ...state,
            resourceList: [...state.resourceList, resource],
          };
        });
      }
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
            resourceIdList: state.resourceList.map((resource) => resource.id),
          });
        }
        editorStateService.clearEditMemo();
      } else {
        await memoService.createMemo({
          content,
          visibility: editorState.memoVisibility,
          resourceIdList: state.resourceList.map((resource) => resource.id),
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
        resourceList: [],
      };
    });
    setEditorContentCache("");
    storage.remove(["editingMemoVisibilityCache"]);
    editorRef.current?.setContent("");
  };

  const handleCancelEdit = () => {
    setState({
      ...state,
      resourceList: [],
    });
    editorStateService.clearEditMemo();
    editorRef.current?.setContent("");
    setEditorContentCache("");
    storage.remove(["editingMemoVisibilityCache"]);
  };

  const handleContentChange = (content: string) => {
    setAllowSave(content !== "");
    setEditorContentCache(content);
  };

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
      setState((state) => {
        return {
          ...state,
          resourceList: [...state.resourceList, ...resourceList],
        };
      });
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

  const handleDeleteResource = async (resourceId: ResourceId) => {
    setState((state) => {
      return {
        ...state,
        resourceList: state.resourceList.filter((resource) => resource.id !== resourceId),
      };
    });

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
    // do nth
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
          <button className="action-btn !hidden sm:!flex ">
            <Icon.Smile className="icon-img" onClick={handleEmojiPickerBtnClick} />
          </button>
          <button className="action-btn">
            <Icon.CheckSquare className="icon-img" onClick={handleCheckBoxBtnClick} />
          </button>
          <button className="action-btn">
            <Icon.Code className="icon-img" onClick={handleCodeBlockBtnClick} />
          </button>
          <button className="action-btn">
            <Icon.FileText className="icon-img" onClick={handleUploadFileBtnClick} />
            <span className={`tip-text ${state.isUploadingResource ? "!block" : ""}`}>Uploading</span>
          </button>
          <button className="action-btn" onClick={handleFullscreenBtnClick}>
            {state.fullscreen ? <Icon.Minimize className="icon-img" /> : <Icon.Maximize className="icon-img" />}
          </button>
          <EmojiPicker
            shouldShow={state.shouldShowEmojiPicker}
            onEmojiClick={handleEmojiClick}
            onShouldShowEmojiPickerChange={handleChangeShouldShowEmojiPicker}
          />
        </div>
      </div>
      {state.resourceList.length > 0 && (
        <div className="resource-list-wrapper">
          {state.resourceList.map((resource) => {
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
