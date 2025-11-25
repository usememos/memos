import copy from "copy-to-clipboard";
import { isEqual } from "lodash-es";
import { LoaderIcon, Minimize2Icon } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import useLocalStorage from "react-use/lib/useLocalStorage";
import { Button } from "@/components/ui/button";
import { memoServiceClient } from "@/grpcweb";
import { TAB_SPACE_WIDTH } from "@/helpers/consts";
import { isValidUrl } from "@/helpers/utils";
import useAsyncEffect from "@/hooks/useAsyncEffect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { attachmentStore, instanceStore, memoStore, userStore } from "@/store";
import { extractMemoIdFromName } from "@/store/common";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { Location, Memo, MemoRelation, MemoRelation_Type, Visibility } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityFromString } from "@/utils/memo";
import DateTimeInput from "../DateTimeInput";
import type { LocalFile } from "../memo-metadata";
import { AttachmentList, LocationDisplay, RelationList } from "../memo-metadata";
import InsertMenu from "./ActionButton/InsertMenu";
import VisibilitySelector from "./ActionButton/VisibilitySelector";
import { FOCUS_MODE_EXIT_KEY, FOCUS_MODE_STYLES, FOCUS_MODE_TOGGLE_KEY, LOCALSTORAGE_DEBOUNCE_DELAY } from "./constants";
import Editor, { EditorRefActions } from "./Editor";
import ErrorBoundary from "./ErrorBoundary";
import { handleEditorKeydownWithMarkdownShortcuts, hyperlinkHighlightedText } from "./handlers";
import { useDebounce } from "./hooks/useDebounce";
import { useDragAndDrop } from "./hooks/useDragAndDrop";
import { useLocalFileManager } from "./hooks/useLocalFileManager";
import { MemoEditorContext } from "./types";
import type { MemoEditorProps, MemoEditorState } from "./types/memo-editor";

// Re-export for backward compatibility
export type { MemoEditorProps as Props };

const MemoEditor = observer((props: MemoEditorProps) => {
  const { className, cacheKey, memoName, parentMemoName, autoFocus, onConfirm, onCancel } = props;
  const t = useTranslate();
  const { i18n } = useTranslation();
  const currentUser = useCurrentUser();

  // Custom hooks for file management
  const { localFiles, addFiles, removeFile, clearFiles } = useLocalFileManager();

  // Internal component state
  const [state, setState] = useState<MemoEditorState>({
    memoVisibility: Visibility.PRIVATE,
    isFocusMode: false,
    attachmentList: [],
    relationList: [],
    location: undefined,
    isUploadingAttachment: false,
    isRequesting: false,
    isComposing: false,
    isDraggingFile: false,
  });
  const [createTime, setCreateTime] = useState<Date | undefined>();
  const [updateTime, setUpdateTime] = useState<Date | undefined>();
  const [hasContent, setHasContent] = useState<boolean>(false);
  const editorRef = useRef<EditorRefActions>(null);
  const userGeneralSetting = userStore.state.userGeneralSetting;
  const contentCacheKey = `${currentUser.name}-${cacheKey || ""}`;
  const [contentCache, setContentCache] = useLocalStorage<string>(contentCacheKey, "");
  const referenceRelations = memoName
    ? state.relationList.filter(
        (relation) =>
          relation.memo?.name === memoName && relation.relatedMemo?.name !== memoName && relation.type === MemoRelation_Type.REFERENCE,
      )
    : state.relationList.filter((relation) => relation.type === MemoRelation_Type.REFERENCE);
  const instanceMemoRelatedSetting = instanceStore.state.memoRelatedSetting;

  useEffect(() => {
    editorRef.current?.setContent(contentCache || "");
  }, []);

  useEffect(() => {
    if (autoFocus) {
      handleEditorFocus();
    }
  }, [autoFocus]);

  useAsyncEffect(async () => {
    let visibility = convertVisibilityFromString(userGeneralSetting?.memoVisibility || "PRIVATE");
    if (instanceMemoRelatedSetting.disallowPublicVisibility && visibility === Visibility.PUBLIC) {
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
  }, [parentMemoName, userGeneralSetting?.memoVisibility, instanceMemoRelatedSetting.disallowPublicVisibility]);

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
        attachmentList: memo.attachments,
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

    // Focus Mode toggle: Cmd/Ctrl + Shift + F
    if (isMetaKey && event.shiftKey && event.key.toLowerCase() === FOCUS_MODE_TOGGLE_KEY) {
      event.preventDefault();
      toggleFocusMode();
      return;
    }

    // Exit Focus Mode: Escape
    if (event.key === FOCUS_MODE_EXIT_KEY && state.isFocusMode) {
      event.preventDefault();
      toggleFocusMode();
      return;
    }

    if (isMetaKey) {
      if (event.key === "Enter") {
        event.preventDefault();
        handleSaveBtnClick();
        return;
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSaveBtnClick();
        return;
      }
      if (!instanceMemoRelatedSetting.disableMarkdownShortcuts) {
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

  /**
   * Toggle Focus Mode on/off
   * Focus Mode provides a distraction-free writing experience with:
   * - Expanded editor taking ~80-90% of viewport
   * - Semi-transparent backdrop
   * - Centered layout with optimal width
   * - All editor functionality preserved
   */
  const toggleFocusMode = () => {
    setState((prevState) => ({
      ...prevState,
      isFocusMode: !prevState.isFocusMode,
    }));
  };

  const handleMemoVisibilityChange = (visibility: Visibility) => {
    setState((prevState) => ({
      ...prevState,
      memoVisibility: visibility,
    }));
  };

  const handleSetAttachmentList = (attachmentList: Attachment[]) => {
    setState((prevState) => ({
      ...prevState,
      attachmentList,
    }));
  };

  // Add local files from InsertMenu
  // Drag-and-drop for file uploads
  const { isDragging, dragHandlers } = useDragAndDrop({
    onDrop: (files) => addFiles(files),
  });

  // Sync drag state with component state
  useEffect(() => {
    setState((prevState) => ({
      ...prevState,
      isDraggingFile: isDragging,
    }));
  }, [isDragging]);

  const handleSetRelationList = (relationList: MemoRelation[]) => {
    setState((prevState) => ({
      ...prevState,
      relationList,
    }));
  };

  const handlePasteEvent = async (event: React.ClipboardEvent) => {
    if (event.clipboardData && event.clipboardData.files.length > 0) {
      event.preventDefault();
      addFiles(event.clipboardData.files);
    } else if (
      editorRef.current != null &&
      editorRef.current.getSelectedContent().length != 0 &&
      isValidUrl(event.clipboardData.getData("Text"))
    ) {
      event.preventDefault();
      hyperlinkHighlightedText(editorRef.current, event.clipboardData.getData("Text"));
    }
  };

  // Debounced cache setter to avoid writing to localStorage on every keystroke
  const saveContentToCache = useDebounce((content: string) => {
    if (content !== "") {
      setContentCache(content);
    } else {
      localStorage.removeItem(contentCacheKey);
    }
  }, LOCALSTORAGE_DEBOUNCE_DELAY);

  const handleContentChange = (content: string) => {
    setHasContent(content !== "");
    saveContentToCache(content);
  };

  const handleSaveBtnClick = async () => {
    if (state.isRequesting) {
      return;
    }

    setState((state) => ({ ...state, isRequesting: true }));
    const content = editorRef.current?.getContent() ?? "";
    try {
      // 1. Upload all local files and create attachments
      const newAttachments: Attachment[] = [];
      if (localFiles.length > 0) {
        setState((state) => ({ ...state, isUploadingAttachment: true }));
        try {
          for (const { file } of localFiles) {
            const buffer = new Uint8Array(await file.arrayBuffer());
            const attachment = await attachmentStore.createAttachment({
              attachment: Attachment.fromPartial({
                filename: file.name,
                size: file.size,
                type: file.type,
                content: buffer,
              }),
              attachmentId: "",
            });
            newAttachments.push(attachment);
          }
        } finally {
          // Always reset upload state, even on error
          setState((state) => ({ ...state, isUploadingAttachment: false }));
        }
      }
      // 2. Update attachmentList with new attachments
      const allAttachments = [...state.attachmentList, ...newAttachments];
      // 3. Save memo (create or update)
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
          if (!isEqual(allAttachments, prevMemo.attachments)) {
            updateMask.add("attachments");
            memoPatch.attachments = allAttachments;
          }
          if (!isEqual(state.relationList, prevMemo.relations)) {
            updateMask.add("relations");
            memoPatch.relations = state.relationList;
          }
          if (!isEqual(state.location, prevMemo.location)) {
            updateMask.add("location");
            memoPatch.location = state.location;
          }
          if (["content", "attachments", "relations", "location"].some((key) => updateMask.has(key))) {
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
            toast.error(t("editor.no-changes-detected"));
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
                attachments: allAttachments,
                relations: state.relationList,
                location: state.location,
              }),
              memoId: "",
            })
          : memoServiceClient
              .createMemoComment({
                name: parentMemoName,
                comment: {
                  content,
                  visibility: state.memoVisibility,
                  attachments: state.attachmentList,
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
      // Clean up local files after successful save
      clearFiles();
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
    }

    localStorage.removeItem(contentCacheKey);
    setState((state) => {
      return {
        ...state,
        isRequesting: false,
        attachmentList: [],
        relationList: [],
        location: undefined,
        isDraggingFile: false,
      };
    });
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
      isFocusMode: state.isFocusMode,
      isInIME: state.isComposing,
      onCompositionStart: handleCompositionStart,
      onCompositionEnd: handleCompositionEnd,
    }),
    [i18n.language, state.isFocusMode, state.isComposing],
  );

  const allowSave =
    (hasContent || state.attachmentList.length > 0 || localFiles.length > 0) && !state.isUploadingAttachment && !state.isRequesting;

  return (
    <ErrorBoundary>
      <MemoEditorContext.Provider
        value={{
          attachmentList: state.attachmentList,
          relationList: state.relationList,
          setAttachmentList: handleSetAttachmentList,
          addLocalFiles: (files) => addFiles(Array.from(files.map((f) => f.file))),
          removeLocalFile: removeFile,
          localFiles,
          setRelationList: (relationList: MemoRelation[]) => {
            setState((prevState) => ({
              ...prevState,
              relationList,
            }));
          },
          memoName,
        }}
      >
        {/* Focus Mode Backdrop */}
        {state.isFocusMode && <div className={FOCUS_MODE_STYLES.backdrop} onClick={toggleFocusMode} />}

        <div
          className={cn(
            "group relative w-full flex flex-col justify-start items-start bg-card px-4 pt-3 pb-2 rounded-lg border",
            FOCUS_MODE_STYLES.transition,
            state.isDraggingFile ? "border-dashed border-muted-foreground cursor-copy" : "border-border cursor-auto",
            state.isFocusMode && cn(FOCUS_MODE_STYLES.container.base, FOCUS_MODE_STYLES.container.spacing),
            className,
          )}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          {...dragHandlers}
          onFocus={handleEditorFocus}
        >
          {/* Focus Mode Exit Button */}
          {state.isFocusMode && (
            <Button
              variant="ghost"
              size="icon"
              className={FOCUS_MODE_STYLES.exitButton}
              onClick={toggleFocusMode}
              title={t("editor.exit-focus-mode")}
            >
              <Minimize2Icon className="w-4 h-4" />
            </Button>
          )}

          <Editor ref={editorRef} {...editorConfig} />
          <LocationDisplay
            mode="edit"
            location={state.location}
            onRemove={() =>
              setState((prevState) => ({
                ...prevState,
                location: undefined,
              }))
            }
          />
          {/* Show attachments and pending files together */}
          <AttachmentList
            mode="edit"
            attachments={state.attachmentList}
            onAttachmentsChange={handleSetAttachmentList}
            localFiles={localFiles}
            onRemoveLocalFile={removeFile}
          />
          <RelationList mode="edit" relations={referenceRelations} onRelationsChange={handleSetRelationList} />
          <div className="relative w-full flex flex-row justify-between items-center pt-2 gap-2" onFocus={(e) => e.stopPropagation()}>
            <div className="flex flex-row justify-start items-center gap-1">
              <InsertMenu
                isUploading={state.isUploadingAttachment}
                location={state.location}
                onLocationChange={(location) =>
                  setState((prevState) => ({
                    ...prevState,
                    location,
                  }))
                }
                onToggleFocusMode={toggleFocusMode}
              />
            </div>
            <div className="shrink-0 flex flex-row justify-end items-center">
              <VisibilitySelector value={state.memoVisibility} onChange={(visibility) => handleMemoVisibilityChange(visibility)} />
              <div className="flex flex-row justify-end gap-1">
                {props.onCancel && (
                  <Button
                    variant="ghost"
                    disabled={state.isRequesting}
                    onClick={() => {
                      clearFiles();
                      if (props.onCancel) props.onCancel();
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                )}
                <Button disabled={!allowSave || state.isRequesting} onClick={handleSaveBtnClick}>
                  {state.isRequesting ? <LoaderIcon className="w-4 h-4 animate-spin" /> : t("editor.save")}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Show memo metadata if memoName is provided */}
        {memoName && (
          <div className="w-full -mt-1 mb-4 text-xs leading-5 px-4 opacity-60 font-mono text-muted-foreground">
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
    </ErrorBoundary>
  );
});

export default MemoEditor;
