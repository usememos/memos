import { Button } from "@usememos/mui";
import copy from "copy-to-clipboard";
import { isEqual } from "lodash-es";
import { LoaderIcon, SendIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import useLocalStorage from "react-use/lib/useLocalStorage";
import { memoServiceClient } from "@/grpcweb";
import { TAB_SPACE_WIDTH } from "@/helpers/consts";
import { isValidUrl } from "@/helpers/utils";
import useAsyncEffect from "@/hooks/useAsyncEffect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { extractMemoIdFromName } from "@/store/common";
import { memoStore, resourceStore, userStore, workspaceStore } from "@/store/v2";
import { Location, Memo, MemoRelation, MemoRelation_Type, Visibility } from "@/types/proto/api/v1/memo_service";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { UserSetting } from "@/types/proto/api/v1/user_service";
import { cn } from "@/utils";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityFromString } from "@/utils/memo";
import DateTimeInput from "../DateTimeInput";
import AddMemoRelationPopover from "./ActionButton/AddMemoRelationPopover";
import LocationSelector from "./ActionButton/LocationSelector";
import MarkdownMenu from "./ActionButton/MarkdownMenu";
import TagSelector from "./ActionButton/TagSelector";
import UploadResourceButton from "./ActionButton/UploadResourceButton";
import VisibilitySelector from "./ActionButton/VisibilitySelector";
import Editor, { EditorRefActions } from "./Editor";
import RelationListView from "./RelationListView";
import ResourceListView from "./ResourceListView";
import { handleEditorKeydownWithMarkdownShortcuts, hyperlinkHighlightedText } from "./handlers";
import { MemoEditorContext } from "./types";

export interface Props {
  className?: string;
  cacheKey?: string;
  placeholder?: string;
  // The name of the memo to be edited.
  memoName?: string;
  // The name of the parent memo if the memo is a comment.
  parentMemoName?: string;
  autoFocus?: boolean;
  onConfirm?: (memoName: string) => void;
  onCancel?: () => void;
}

interface State {
  memoVisibility: Visibility;
  resourceList: Resource[];
  relationList: MemoRelation[];
  location: Location | undefined;
  isUploadingResource: boolean;
  isRequesting: boolean;
  isComposing: boolean;
  isDraggingFile: boolean;
}

const MemoEditor = observer((props: Props) => {
  const { className, cacheKey, memoName, parentMemoName, autoFocus, onConfirm, onCancel } = props;
  const t = useTranslate();
  const { i18n } = useTranslation();
  const currentUser = useCurrentUser();
  const [state, setState] = useState<State>({
    memoVisibility: Visibility.PRIVATE,
    resourceList: [],
    relationList: [],
    location: undefined,
    isUploadingResource: false,
    isRequesting: false,
    isComposing: false,
    isDraggingFile: false,
  });
  const [createTime, setCreateTime] = useState<Date | undefined>();
  const [updateTime, setUpdateTime] = useState<Date | undefined>();
  const [hasContent, setHasContent] = useState<boolean>(false);
  const [isVisibilitySelectorOpen, setIsVisibilitySelectorOpen] = useState(false);
  const editorRef = useRef<EditorRefActions>(null);
  const userSetting = userStore.state.userSetting as UserSetting;
  const contentCacheKey = `${currentUser.name}-${cacheKey || ""}`;
  const [contentCache, setContentCache] = useLocalStorage<string>(contentCacheKey, "");
  const referenceRelations = memoName
    ? state.relationList.filter(
        (relation) =>
          relation.memo?.name === memoName && relation.relatedMemo?.name !== memoName && relation.type === MemoRelation_Type.REFERENCE,
      )
    : state.relationList.filter((relation) => relation.type === MemoRelation_Type.REFERENCE);
  const workspaceMemoRelatedSetting = workspaceStore.state.memoRelatedSetting;

  useEffect(() => {
    editorRef.current?.setContent(contentCache || "");
  }, []);

  useEffect(() => {
    if (autoFocus) {
      handleEditorFocus();
    }
  }, [autoFocus]);

  useAsyncEffect(async () => {
    let visibility = convertVisibilityFromString(userSetting.memoVisibility);
    if (workspaceMemoRelatedSetting.disallowPublicVisibility && visibility === Visibility.PUBLIC) {
      visibility = Visibility.PROTECTED;
    }
    if (parentMemoName) {
      const parentMemo = await memoStore.getOrFetchMemoByName(parentMemoName);
      visibility = parentMemo.visibility;
    }
    setState((prevState) => ({
      ...prevState,
      memoVisibility: convertVisibilityFromString(visibility),
    }));
  }, [parentMemoName, userSetting.memoVisibility, workspaceMemoRelatedSetting.disallowPublicVisibility]);

  useAsyncEffect(async () => {
    if (!memoName) {
      return;
    }

    const memo = await memoStore.getOrFetchMemoByName(memoName);
    if (memo) {
      handleEditorFocus();
      setCreateTime(memo.createTime);
      setUpdateTime(memo.updateTime);
      setState((prevState) => ({
        ...prevState,
        memoVisibility: memo.visibility,
        resourceList: memo.resources,
        relationList: memo.relations,
        location: memo.location,
      }));
      if (!contentCache) {
        editorRef.current?.setContent(memo.content ?? "");
      }
    }
  }, [memoName]);

  const handleCompositionStart = () => {
    setState((prevState) => ({
      ...prevState,
      isComposing: true,
    }));
  };

  const handleCompositionEnd = () => {
    setState((prevState) => ({
      ...prevState,
      isComposing: false,
    }));
  };

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
      if (!workspaceMemoRelatedSetting.disableMarkdownShortcuts) {
        handleEditorKeydownWithMarkdownShortcuts(event, editorRef.current);
      }
    }
    if (event.key === "Tab" && !state.isComposing) {
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

    const { name: filename, size, type } = file;
    const buffer = new Uint8Array(await file.arrayBuffer());

    try {
      const resource = await resourceStore.createResource({
        resource: Resource.fromPartial({
          filename,
          size,
          type,
          content: buffer,
        }),
      });
      setState((state) => {
        return {
          ...state,
          isUploadingResource: false,
        };
      });
      return resource;
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
      setState((state) => {
        return {
          ...state,
          isUploadingResource: false,
        };
      });
    }
  };

  const uploadMultiFiles = async (files: FileList) => {
    const uploadedResourceList: Resource[] = [];
    for (const file of files) {
      const resource = await handleUploadResource(file);
      if (resource) {
        uploadedResourceList.push(resource);
        if (memoName) {
          await resourceStore.updateResource({
            resource: Resource.fromPartial({
              name: resource.name,
              memo: memoName,
            }),
            updateMask: ["memo"],
          });
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
      setState((prevState) => ({
        ...prevState,
        isDraggingFile: false,
      }));

      await uploadMultiFiles(event.dataTransfer.files);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    if (event.dataTransfer && event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      if (!state.isDraggingFile) {
        setState((prevState) => ({
          ...prevState,
          isDraggingFile: true,
        }));
      }
    }
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setState((prevState) => ({
      ...prevState,
      isDraggingFile: false,
    }));
  };

  const handlePasteEvent = async (event: React.ClipboardEvent) => {
    if (event.clipboardData && event.clipboardData.files.length > 0) {
      event.preventDefault();
      await uploadMultiFiles(event.clipboardData.files);
    } else if (
      editorRef.current != null &&
      editorRef.current.getSelectedContent().length != 0 &&
      isValidUrl(event.clipboardData.getData("Text"))
    ) {
      event.preventDefault();
      hyperlinkHighlightedText(editorRef.current, event.clipboardData.getData("Text"));
    }
  };

  const handleContentChange = (content: string) => {
    setHasContent(content !== "");
    if (content !== "") {
      setContentCache(content);
    } else {
      localStorage.removeItem(contentCacheKey);
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
      // Update memo.
      if (memoName) {
        const prevMemo = await memoStore.getOrFetchMemoByName(memoName);
        if (prevMemo) {
          const updateMask = new Set<string>();
          const memoPatch: Partial<Memo> = {
            name: prevMemo.name,
            content,
          };
          if (!isEqual(content, prevMemo.content)) {
            updateMask.add("content");
            memoPatch.content = content;
          }
          if (!isEqual(state.memoVisibility, prevMemo.visibility)) {
            updateMask.add("visibility");
            memoPatch.visibility = state.memoVisibility;
          }
          if (!isEqual(state.resourceList, prevMemo.resources)) {
            updateMask.add("resources");
            memoPatch.resources = state.resourceList;
          }
          if (!isEqual(state.relationList, prevMemo.relations)) {
            updateMask.add("relations");
            memoPatch.relations = state.relationList;
          }
          if (!isEqual(state.location, prevMemo.location)) {
            updateMask.add("location");
            memoPatch.location = state.location;
          }
          if (["content", "resources", "relations", "location"].some((key) => updateMask.has(key))) {
            updateMask.add("update_time");
          }
          if (createTime && !isEqual(createTime, prevMemo.createTime)) {
            updateMask.add("create_time");
            memoPatch.createTime = createTime;
          }
          if (updateTime && !isEqual(updateTime, prevMemo.updateTime)) {
            updateMask.add("update_time");
            memoPatch.updateTime = updateTime;
          }
          if (updateMask.size === 0) {
            toast.error("No changes detected");
            if (onCancel) {
              onCancel();
            }
            return;
          }
          const memo = await memoStore.updateMemo(memoPatch, Array.from(updateMask));
          if (onConfirm) {
            onConfirm(memo.name);
          }
        }
      } else {
        // Create memo or memo comment.
        const request = !parentMemoName
          ? memoStore.createMemo({
              memo: Memo.fromPartial({
                content,
                visibility: state.memoVisibility,
                resources: state.resourceList,
                relations: state.relationList,
                location: state.location,
              }),
            })
          : memoServiceClient
              .createMemoComment({
                name: parentMemoName,
                comment: {
                  content,
                  visibility: state.memoVisibility,
                  resources: state.resourceList,
                  relations: state.relationList,
                  location: state.location,
                },
              })
              .then((memo) => memo);
        const memo = await request;
        if (onConfirm) {
          onConfirm(memo.name);
        }
      }
      editorRef.current?.setContent("");
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
    }

    localStorage.removeItem(contentCacheKey);
    setState((state) => {
      return {
        ...state,
        isRequesting: false,
        resourceList: [],
        relationList: [],
        location: undefined,
        isDraggingFile: false,
      };
    });
  };

  const handleCancelBtnClick = () => {
    localStorage.removeItem(contentCacheKey);

    if (onCancel) {
      onCancel();
    }
  };

  const handleEditorFocus = () => {
    editorRef.current?.focus();
  };

  const editorConfig = useMemo(
    () => ({
      className: "",
      initialContent: "",
      placeholder: props.placeholder ?? t("editor.any-thoughts"),
      onContentChange: handleContentChange,
      onPaste: handlePasteEvent,
    }),
    [i18n.language],
  );

  const allowSave = (hasContent || state.resourceList.length > 0) && !state.isUploadingResource && !state.isRequesting;

  return (
    <MemoEditorContext.Provider
      value={{
        resourceList: state.resourceList,
        relationList: state.relationList,
        setResourceList: (resourceList: Resource[]) => {
          setState((prevState) => ({
            ...prevState,
            resourceList,
          }));
        },
        setRelationList: (relationList: MemoRelation[]) => {
          setState((prevState) => ({
            ...prevState,
            relationList,
          }));
        },
        memoName,
      }}
    >
      <div
        className={cn(
          "group relative w-full flex flex-col justify-start items-start bg-white dark:bg-zinc-800 px-4 pt-3 pb-2 rounded-lg border",
          state.isDraggingFile
            ? "border-dashed border-gray-400 dark:border-primary-400 cursor-copy"
            : "border-gray-200 dark:border-zinc-700 cursor-auto",
          className,
        )}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onDrop={handleDropEvent}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onFocus={handleEditorFocus}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
      >
        <Editor ref={editorRef} {...editorConfig} />
        <ResourceListView resourceList={state.resourceList} setResourceList={handleSetResourceList} />
        <RelationListView relationList={referenceRelations} setRelationList={handleSetRelationList} />
        <div className="relative w-full flex flex-row justify-between items-center py-1" onFocus={(e) => e.stopPropagation()}>
          <div className="flex flex-row justify-start items-center opacity-80 dark:opacity-60 space-x-2">
            <TagSelector editorRef={editorRef} />
            <MarkdownMenu editorRef={editorRef} />
            <UploadResourceButton isUploadingResource={state.isUploadingResource} />
            <AddMemoRelationPopover editorRef={editorRef} />
            <LocationSelector
              location={state.location}
              onChange={(location) =>
                setState((prevState) => ({
                  ...prevState,
                  location,
                }))
              }
            />
          </div>
          <div className="shrink-0 -mr-1 flex flex-row justify-end items-center">
            {props.onCancel && (
              <Button variant="plain" className="opacity-60" disabled={state.isRequesting} onClick={handleCancelBtnClick}>
                {t("common.cancel")}
              </Button>
            )}
            <Button color="primary" disabled={!allowSave || state.isRequesting} onClick={handleSaveBtnClick}>
              {t("editor.save")}
              {!state.isRequesting ? <SendIcon className="w-4 h-auto ml-1" /> : <LoaderIcon className="w-4 h-auto ml-1 animate-spin" />}
            </Button>
          </div>
        </div>
        <div
          className={cn(
            "absolute right-1 top-1 opacity-60",
            "invisible group-focus-within:visible group-hover:visible hover:visible focus-within:visible",
            (isVisibilitySelectorOpen || memoName) && "visible",
          )}
          onFocus={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <VisibilitySelector
            value={state.memoVisibility}
            onChange={handleMemoVisibilityChange}
            onOpenChange={setIsVisibilitySelectorOpen}
          />
        </div>
      </div>

      {/* Show memo metadata if memoName is provided */}
      {memoName && (
        <div className="w-full -mt-1 mb-4 text-xs leading-5 px-4 opacity-60 font-mono text-gray-500 dark:text-zinc-500">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 items-center">
            {!isEqual(createTime, updateTime) && updateTime && (
              <>
                <span className="text-left">Updated</span>
                <DateTimeInput value={updateTime} onChange={setUpdateTime} />
              </>
            )}
            {createTime && (
              <>
                <span className="text-left">Created</span>
                <DateTimeInput value={createTime} onChange={setCreateTime} />
              </>
            )}
            <span className="text-left">ID</span>
            <span
              className="px-1 border border-transparent cursor-default"
              onClick={() => {
                copy(extractMemoIdFromName(memoName));
                toast.success(t("message.copied"));
              }}
            >
              {extractMemoIdFromName(memoName)}
            </span>
          </div>
        </div>
      )}
    </MemoEditorContext.Provider>
  );
});

export default MemoEditor;
