import { isNumber, last, uniq } from "lodash-es";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getMatchedNodes } from "@/labs/marked";
import { upsertMemoResource } from "@/helpers/api";
import { TAB_SPACE_WIDTH, UNKNOWN_ID } from "@/helpers/consts";
import { useEditorStore, useFilterStore, useMemoStore, useResourceStore, useTagStore, useUserStore } from "@/store/module";
import storage from "@/helpers/storage";
import { clearContentQueryParam, getContentQueryParam } from "@/helpers/utils";
import Icon from "../Icon";
import Editor, { EditorRefActions } from "./Editor";
import TagSelector from "./ActionButton/TagSelector";
import ResourceSelector from "./ActionButton/ResourceSelector";
import MemoVisibilitySelector from "./ActionButton/MemoVisibilitySelector";
import ResourceListView from "./ResourceListView";
import RelationListView from "./RelationListView";
import "@/less/memo-editor.less";

const listItemSymbolList = ["- [ ] ", "- [x] ", "- [X] ", "* ", "- "];
const emptyOlReg = /^(\d+)\. $/;

const getInitialContent = (): string => {
  return getContentQueryParam() ?? storage.get(["editorContentCache"]).editorContentCache ?? "";
};

const setEditorContentCache = (content: string) => {
  storage.set({
    editorContentCache: content,
  });
};

interface State {
  fullscreen: boolean;
  isUploadingResource: boolean;
  isRequesting: boolean;
}

const MemoEditor = () => {
  const { t, i18n } = useTranslation();
  const userStore = useUserStore();
  const editorStore = useEditorStore();
  const filterStore = useFilterStore();
  const memoStore = useMemoStore();
  const tagStore = useTagStore();
  const resourceStore = useResourceStore();

  const [state, setState] = useState<State>({
    fullscreen: false,
    isUploadingResource: false,
    isRequesting: false,
  });
  const [allowSave, setAllowSave] = useState<boolean>(false);
  const [isInIME, setIsInIME] = useState(false);
  const editorState = editorStore.state;
  const prevEditorStateRef = useRef(editorState);
  const editorRef = useRef<EditorRefActions>(null);
  const user = userStore.state.user as User;
  const setting = user.setting;

  useEffect(() => {
    const { editingMemoIdCache } = storage.get(["editingMemoIdCache"]);
    if (editingMemoIdCache) {
      editorStore.setEditMemoWithId(editingMemoIdCache);
    } else {
      editorStore.setMemoVisibility(setting.memoVisibility);
    }
  }, []);

  useEffect(() => {
    if (editorState.editMemoId) {
      memoStore.getMemoById(editorState.editMemoId ?? UNKNOWN_ID).then((memo) => {
        if (memo) {
          handleEditorFocus();
          editorStore.setMemoVisibility(memo.visibility);
          editorStore.setResourceList(memo.resourceList);
          editorStore.setRelationList(memo.relationList);
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

  useEffect(() => {
    handleEditorFocus();
  }, [editorStore.state.relationList]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!editorRef.current) {
      return;
    }

    const isMetaKey = event.ctrlKey || event.metaKey;
    if (isMetaKey) {
      if (event.key === "Enter") {
        handleSaveBtnClick();
        return;
      }
    }
    if (event.key === "Enter" && !isInIME) {
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
          editorRef.current?.scrollToCursor();
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
      const tabSpace = " ".repeat(TAB_SPACE_WIDTH);
      const cursorPosition = editorRef.current.getCursorPosition();
      const selectedContent = editorRef.current.getSelectedContent();
      editorRef.current.insertText(tabSpace);
      if (selectedContent) {
        editorRef.current.setCursorPosition(cursorPosition + TAB_SPACE_WIDTH);
      }
      return;
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
      resource = await resourceStore.createResourceWithBlob(file);
    } catch (error: any) {
      console.error(error);
      toast.error(typeof error === "string" ? error : error.response.data.message);
    }

    setState((state) => {
      return {
        ...state,
        isUploadingResource: false,
      };
    });
    return resource;
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
      const resourceList = editorStore.getState().resourceList;
      editorStore.setResourceList([...resourceList, ...uploadedResourceList]);
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

  const handleSaveBtnClick = async () => {
    if (state.isRequesting) {
      return;
    }

    setState((state) => {
      return {
        ...state,
        isRequesting: true,
      };
    });
    const content = editorRef.current?.getContent() ?? "";
    try {
      const { editMemoId } = editorStore.getState();
      if (editMemoId && editMemoId !== UNKNOWN_ID) {
        const prevMemo = await memoStore.getMemoById(editMemoId ?? UNKNOWN_ID);

        if (prevMemo) {
          await memoStore.patchMemo({
            id: prevMemo.id,
            content,
            visibility: editorState.memoVisibility,
            resourceIdList: editorState.resourceList.map((resource) => resource.id),
            relationList: editorState.relationList,
          });
        }
        editorStore.clearEditMemo();
      } else {
        await memoStore.createMemo({
          content,
          visibility: editorState.memoVisibility,
          resourceIdList: editorState.resourceList.map((resource) => resource.id),
          relationList: editorState.relationList,
        });
        filterStore.clearFilter();
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
    }
    setState((state) => {
      return {
        ...state,
        isRequesting: false,
      };
    });

    // Upsert tag with the content.
    const matchedNodes = getMatchedNodes(content);
    const tagNameList = uniq(matchedNodes.filter((node) => node.parserName === "tag").map((node) => node.matchedContent.slice(1)));
    for (const tagName of tagNameList) {
      await tagStore.upsertTag(tagName);
    }

    setState((state) => {
      return {
        ...state,
        fullscreen: false,
      };
    });
    editorStore.setResourceList([]);
    editorStore.setRelationList([]);
    setEditorContentCache("");
    editorRef.current?.setContent("");
    clearContentQueryParam();
  };

  const handleCancelEdit = () => {
    if (editorState.editMemoId) {
      editorStore.clearEditMemo();
      editorStore.setResourceList([]);
      editorStore.setRelationList([]);
      editorRef.current?.setContent("");
      setEditorContentCache("");
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
    editorRef.current?.scrollToCursor();
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
    editorRef.current?.scrollToCursor();
  };

  const handleFullscreenBtnClick = useCallback(() => {
    setState((state) => {
      return {
        ...state,
        fullscreen: !state.fullscreen,
      };
    });
  }, []);

  const handleTagSelectorClick = useCallback((tag: string) => {
    editorRef.current?.insertText(`#${tag} `);
  }, []);

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
      initialContent: getInitialContent(),
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
      onCompositionStart={() => setIsInIME(true)}
      onCompositionEnd={() => setIsInIME(false)}
    >
      <Editor ref={editorRef} {...editorConfig} />
      <div className="common-tools-wrapper">
        <div className="common-tools-container">
          <TagSelector onTagSelectorClick={(tag) => handleTagSelectorClick(tag)} />
          <button className="action-btn">
            <Icon.CheckSquare className="icon-img" onClick={handleCheckBoxBtnClick} />
          </button>
          <button className="action-btn">
            <Icon.Code className="icon-img" onClick={handleCodeBlockBtnClick} />
          </button>
          <ResourceSelector />
          <button className="action-btn" onClick={handleFullscreenBtnClick}>
            {state.fullscreen ? <Icon.Minimize className="icon-img" /> : <Icon.Maximize className="icon-img" />}
          </button>
        </div>
      </div>
      <ResourceListView />
      <RelationListView />
      <div className="editor-footer-container">
        <MemoVisibilitySelector />
        <div className="buttons-container">
          <button className={`action-btn cancel-btn ${isEditing ? "" : "!hidden"}`} onClick={handleCancelEdit}>
            {t("editor.cancel-edit")}
          </button>
          <button
            className="action-btn confirm-btn"
            disabled={!(allowSave || editorState.resourceList.length > 0) || state.isUploadingResource || state.isRequesting}
            onClick={handleSaveBtnClick}
          >
            {t("editor.save")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemoEditor;
