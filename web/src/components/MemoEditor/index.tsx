import { isNumber, last, uniq } from "lodash-es";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { upsertMemoResource } from "@/helpers/api";
import { TAB_SPACE_WIDTH, UNKNOWN_ID } from "@/helpers/consts";
import { clearContentQueryParam } from "@/helpers/utils";
import { getMatchedNodes } from "@/labs/marked";
import { useFilterStore, useGlobalStore, useMemoStore, useResourceStore, useTagStore, useUserStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import showCreateResourceDialog from "../CreateResourceDialog";
import Icon from "../Icon";
import MemoVisibilitySelector from "./ActionButton/MemoVisibilitySelector";
import TagSelector from "./ActionButton/TagSelector";
import Editor, { EditorRefActions } from "./Editor";
import RelationListView from "./RelationListView";
import ResourceListView from "./ResourceListView";
import "@/less/memo-editor.less";

const listItemSymbolList = ["- [ ] ", "- [x] ", "- [X] ", "* ", "- "];
const emptyOlReg = /^(\d+)\. $/;

interface Props {
  className?: string;
  memoId?: MemoId;
  relationList?: MemoRelation[];
  onConfirm?: () => void;
}

interface State {
  memoVisibility: Visibility;
  resourceList: Resource[];
  relationList: MemoRelation[];
  isUploadingResource: boolean;
  isRequesting: boolean;
}

const MemoEditor = (props: Props) => {
  const { className, memoId, onConfirm } = props;
  const { i18n } = useTranslation();
  const t = useTranslate();
  const {
    state: { systemStatus },
  } = useGlobalStore();
  const userStore = useUserStore();
  const filterStore = useFilterStore();
  const memoStore = useMemoStore();
  const tagStore = useTagStore();
  const resourceStore = useResourceStore();

  const [state, setState] = useState<State>({
    memoVisibility: "PRIVATE",
    resourceList: [],
    relationList: props.relationList ?? [],
    isUploadingResource: false,
    isRequesting: false,
  });
  const [hasContent, setHasContent] = useState<boolean>(false);
  const [isInIME, setIsInIME] = useState(false);
  const editorRef = useRef<EditorRefActions>(null);
  const user = userStore.state.user as User;
  const setting = user.setting;

  useEffect(() => {
    let visibility = setting.memoVisibility;
    if (systemStatus.disablePublicMemos && visibility === "PUBLIC") {
      visibility = "PRIVATE";
    }
    setState((prevState) => ({
      ...prevState,
      memoVisibility: visibility,
    }));
  }, [setting.memoVisibility, systemStatus.disablePublicMemos]);

  useEffect(() => {
    if (memoId) {
      memoStore.getMemoById(memoId ?? UNKNOWN_ID).then((memo) => {
        if (memo) {
          handleEditorFocus();
          setState((prevState) => ({
            ...prevState,
            memoVisibility: memo.visibility,
            resourceList: memo.resourceList,
            relationList: memo.relationList,
          }));
          editorRef.current?.setContent(memo.content ?? "");
        }
      });
    }
  }, [memoId]);

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

  const handleMemoVisibilityChange = (visibility: Visibility) => {
    setState((prevState) => ({
      ...prevState,
      memoVisibility: visibility,
    }));
  };

  const handleUploadFileBtnClick = () => {
    showCreateResourceDialog({
      onConfirm: (resourceList) => {
        setState((prevState) => ({
          ...prevState,
          resourceList: [...prevState.resourceList, ...resourceList],
        }));
      },
    });
  };

  const handleSetResourceList = (resourceList: Resource[]) => {
    setState((prevState) => ({
      ...prevState,
      resourceList,
    }));
  };

  const handleSetRelationList = (relationList: MemoRelation[]) => {
    setState((prevState) => ({
      ...prevState,
      relationList,
    }));
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
        if (memoId) {
          await upsertMemoResource(memoId, resource.id);
        }
      }
    }
    if (uploadedResourceList.length > 0) {
      setState((prevState) => ({
        ...prevState,
        resourceList: [...prevState.resourceList, ...uploadedResourceList],
      }));
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

  const handleContentChange = (content: string) => {
    setHasContent(content !== "");
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
      if (memoId && memoId !== UNKNOWN_ID) {
        const prevMemo = await memoStore.getMemoById(memoId ?? UNKNOWN_ID);

        if (prevMemo) {
          await memoStore.patchMemo({
            id: prevMemo.id,
            content,
            visibility: state.memoVisibility,
            resourceIdList: state.resourceList.map((resource) => resource.id),
            relationList: state.relationList,
          });
        }
      } else {
        await memoStore.createMemo({
          content,
          visibility: state.memoVisibility,
          resourceIdList: state.resourceList.map((resource) => resource.id),
          relationList: state.relationList,
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

    setState((prevState) => ({
      ...prevState,
      resourceList: [],
      relationList: [],
    }));
    editorRef.current?.setContent("");
    clearContentQueryParam();
    if (onConfirm) {
      onConfirm();
    }
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

  const handleTagSelectorClick = useCallback((tag: string) => {
    editorRef.current?.insertText(`#${tag} `);
  }, []);

  const handleEditorFocus = () => {
    editorRef.current?.focus();
  };

  const editorConfig = useMemo(
    () => ({
      className: `memo-editor`,
      initialContent: "",
      placeholder: t("editor.placeholder"),
      onContentChange: handleContentChange,
      onPaste: handlePasteEvent,
    }),
    [i18n.language]
  );

  const allowSave = (hasContent || state.resourceList.length > 0) && !state.isUploadingResource && !state.isRequesting;

  return (
    <div
      className={`${className ?? ""} memo-editor-container`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onDrop={handleDropEvent}
      onFocus={handleEditorFocus}
      onCompositionStart={() => setIsInIME(true)}
      onCompositionEnd={() => setIsInIME(false)}
    >
      <Editor ref={editorRef} {...editorConfig} />
      <div className="common-tools-wrapper">
        <div className="common-tools-container">
          <TagSelector onTagSelectorClick={(tag) => handleTagSelectorClick(tag)} />
          <button className="action-btn">
            <Icon.Image className="icon-img" onClick={handleUploadFileBtnClick} />
          </button>
          <button className="action-btn">
            <Icon.CheckSquare className="icon-img" onClick={handleCheckBoxBtnClick} />
          </button>
          <button className="action-btn">
            <Icon.Code className="icon-img" onClick={handleCodeBlockBtnClick} />
          </button>
        </div>
      </div>
      <ResourceListView resourceList={state.resourceList} setResourceList={handleSetResourceList} />
      <RelationListView relationList={state.relationList} setRelationList={handleSetRelationList} />
      <div className="editor-footer-container">
        <MemoVisibilitySelector value={state.memoVisibility} onChange={handleMemoVisibilityChange} />
        <div className="buttons-container">
          <button className="action-btn confirm-btn" disabled={!allowSave} onClick={handleSaveBtnClick}>
            {t("editor.save")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemoEditor;
