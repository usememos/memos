import copy from "copy-to-clipboard";
import { isEqual } from "lodash-es";
import { LoaderIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import useLocalStorage from "react-use/lib/useLocalStorage";
import { Button } from "@/components/ui/button";
import { TAB_SPACE_WIDTH } from "@/helpers/consts";
import { isValidUrl } from "@/helpers/utils";
import useAsyncEffect from "@/hooks/useAsyncEffect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { instanceStore, memoStore, userStore } from "@/store";
import { extractMemoIdFromName } from "@/store/common";
import type { Attachment } from "@/types/proto/api/v1/attachment_service";
import { type Location, type MemoRelation, MemoRelation_Type, Visibility } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityFromString } from "@/utils/memo";
import DateTimeInput from "../DateTimeInput";
import { AttachmentList, LocationDisplay, RelationList } from "../memo-metadata";
import { FocusModeExitButton, FocusModeOverlay } from "./components";
import { FOCUS_MODE_EXIT_KEY, FOCUS_MODE_STYLES, FOCUS_MODE_TOGGLE_KEY, LOCALSTORAGE_DEBOUNCE_DELAY } from "./constants";
import Editor, { type EditorRefActions } from "./Editor";
import { handleEditorKeydownWithMarkdownShortcuts, hyperlinkHighlightedText } from "./Editor/markdownShortcuts";
import ErrorBoundary from "./ErrorBoundary";
import { useDebounce, useDragAndDrop, useFocusMode, useLocalFileManager, useMemoSave } from "./hooks";
import InsertMenu from "./Toolbar/InsertMenu";
import VisibilitySelector from "./Toolbar/VisibilitySelector";
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

  // Memo save hook - handles create/update logic
  const { saveMemo } = useMemoSave({
    onUploadingChange: useCallback((uploading: boolean) => {
      setState((s) => ({ ...s, isUploadingAttachment: uploading }));
    }, []),
    onRequestingChange: useCallback((requesting: boolean) => {
      setState((s) => ({ ...s, isRequesting: requesting }));
    }, []),
    onSuccess: useCallback(
      (savedMemoName: string) => {
        editorRef.current?.setContent("");
        clearFiles();
        localStorage.removeItem(contentCacheKey);
        if (onConfirm) onConfirm(savedMemoName);
      },
      [clearFiles, contentCacheKey, onConfirm],
    ),
    onCancel: useCallback(() => {
      if (onCancel) onCancel();
    }, [onCancel]),
    onReset: useCallback(() => {
      setState((s) => ({
        ...s,
        isRequesting: false,
        attachmentList: [],
        relationList: [],
        location: undefined,
        isDraggingFile: false,
      }));
    }, []),
    t,
  });

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

  // Focus mode management with body scroll lock
  const { toggleFocusMode } = useFocusMode({
    isFocusMode: state.isFocusMode,
    onToggle: () => {
      setState((prevState) => ({
        ...prevState,
        isFocusMode: !prevState.isFocusMode,
      }));
    },
  });

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
      handleEditorKeydownWithMarkdownShortcuts(event, editorRef.current);
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
      editorRef.current.getSelectedContent().length !== 0 &&
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
    const content = editorRef.current?.getContent() ?? "";
    await saveMemo(content, {
      memoName,
      parentMemoName,
      visibility: state.memoVisibility,
      attachmentList: state.attachmentList,
      relationList: state.relationList,
      location: state.location,
      localFiles,
      createTime,
      updateTime,
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
        <FocusModeOverlay isActive={state.isFocusMode} onToggle={toggleFocusMode} />

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
          <FocusModeExitButton isActive={state.isFocusMode} onToggle={toggleFocusMode} title={t("editor.exit-focus-mode")} />

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
              <button
                type="button"
                className="px-1 border border-transparent cursor-default text-left"
                onClick={() => {
                  copy(extractMemoIdFromName(memoName));
                  toast.success(t("message.copied"));
                }}
              >
                {extractMemoIdFromName(memoName)}
              </button>
            </div>
          </div>
        )}
      </MemoEditorContext.Provider>
    </ErrorBoundary>
  );
});

export default MemoEditor;
