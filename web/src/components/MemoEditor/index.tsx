import copy from "copy-to-clipboard";
import { isEqual } from "lodash-es";
import { LoaderIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import useLocalStorage from "react-use/lib/useLocalStorage";
import { Button } from "@/components/ui/button";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { extractMemoIdFromName } from "@/store/common";
import { MemoRelation_Type } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import DateTimeInput from "../DateTimeInput";
import { AttachmentList, LocationDisplay, RelationList } from "../memo-metadata";
import { FocusModeExitButton, FocusModeOverlay } from "./components";
import { FOCUS_MODE_STYLES, LOCALSTORAGE_DEBOUNCE_DELAY } from "./constants";
import Editor, { type EditorRefActions } from "./Editor";
import {
  useDragAndDrop,
  useFocusMode,
  useLocalFileManager,
  useMemoEditorHandlers,
  useMemoEditorInit,
  useMemoEditorKeyboard,
  useMemoEditorState,
  useMemoSave,
} from "./hooks";
import InsertMenu from "./Toolbar/InsertMenu";
import VisibilitySelector from "./Toolbar/VisibilitySelector";
import { MemoEditorContext } from "./types";

export interface Props {
  className?: string;
  cacheKey?: string;
  placeholder?: string;
  memoName?: string;
  parentMemoName?: string;
  autoFocus?: boolean;
  onConfirm?: (memoName: string) => void;
  onCancel?: () => void;
}

const MemoEditor = observer((props: Props) => {
  const { className, cacheKey, memoName, parentMemoName, autoFocus, onConfirm, onCancel } = props;
  const t = useTranslate();
  const { i18n } = useTranslation();
  const currentUser = useCurrentUser();
  const editorRef = useRef<EditorRefActions>(null);

  // Content caching
  const contentCacheKey = `${currentUser.name}-${cacheKey || ""}`;
  const [contentCache, setContentCache] = useLocalStorage<string>(contentCacheKey, "");
  const [hasContent, setHasContent] = useState<boolean>(false);

  // Custom hooks for file management
  const { localFiles, addFiles, removeFile, clearFiles } = useLocalFileManager();

  // Custom hooks for state management
  const {
    memoVisibility,
    attachmentList,
    relationList,
    location,
    isFocusMode,
    isUploadingAttachment,
    isRequesting,
    isComposing,
    isDraggingFile,
    setMemoVisibility,
    setAttachmentList,
    setRelationList,
    setLocation,
    toggleFocusMode,
    setUploadingAttachment,
    setRequesting,
    setComposing,
    setDraggingFile,
    resetState,
  } = useMemoEditorState();

  // Event handlers hook
  const { handleCompositionStart, handleCompositionEnd, handlePasteEvent, handleEditorFocus } = useMemoEditorHandlers({
    editorRef,
    onContentChange: (content: string) => {
      setHasContent(content !== "");
      saveContentToCache(content);
    },
    onFilesAdded: addFiles,
    setComposing,
  });

  // Initialization hook
  const { createTime, updateTime, setCreateTime, setUpdateTime } = useMemoEditorInit({
    editorRef,
    memoName,
    parentMemoName,
    contentCache,
    autoFocus,
    onEditorFocus: handleEditorFocus,
    onVisibilityChange: setMemoVisibility,
    onAttachmentsChange: setAttachmentList,
    onRelationsChange: setRelationList,
    onLocationChange: setLocation,
  });

  // Memo save hook - handles create/update logic
  const { saveMemo } = useMemoSave({
    onUploadingChange: setUploadingAttachment,
    onRequestingChange: setRequesting,
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
    onReset: resetState,
    t,
  });

  // Save memo handler
  const handleSaveBtnClick = useCallback(async () => {
    if (isRequesting) {
      return;
    }
    const content = editorRef.current?.getContent() ?? "";
    await saveMemo(content, {
      memoName,
      parentMemoName,
      visibility: memoVisibility,
      attachmentList,
      relationList,
      location,
      localFiles,
      createTime,
      updateTime,
    });
  }, [
    isRequesting,
    saveMemo,
    memoName,
    parentMemoName,
    memoVisibility,
    attachmentList,
    relationList,
    location,
    localFiles,
    createTime,
    updateTime,
  ]);

  // Keyboard shortcuts hook
  const { handleKeyDown } = useMemoEditorKeyboard({
    editorRef,
    isFocusMode,
    isComposing,
    onSave: handleSaveBtnClick,
    onToggleFocusMode: toggleFocusMode,
  });

  // Focus mode management with body scroll lock
  useFocusMode(isFocusMode);

  // Drag-and-drop for file uploads
  const { isDragging, dragHandlers } = useDragAndDrop(addFiles);

  // Sync drag state with component state
  useEffect(() => {
    setDraggingFile(isDragging);
  }, [isDragging, setDraggingFile]);

  // Debounced cache setter
  const cacheTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const saveContentToCache = useCallback(
    (content: string) => {
      clearTimeout(cacheTimeoutRef.current);
      cacheTimeoutRef.current = setTimeout(() => {
        if (content !== "") {
          setContentCache(content);
        } else {
          localStorage.removeItem(contentCacheKey);
        }
      }, LOCALSTORAGE_DEBOUNCE_DELAY);
    },
    [contentCacheKey, setContentCache],
  );

  // Compute reference relations
  const referenceRelations = useMemo(() => {
    if (memoName) {
      return relationList.filter(
        (relation) =>
          relation.memo?.name === memoName && relation.relatedMemo?.name !== memoName && relation.type === MemoRelation_Type.REFERENCE,
      );
    }
    return relationList.filter((relation) => relation.type === MemoRelation_Type.REFERENCE);
  }, [memoName, relationList]);

  const editorConfig = useMemo(
    () => ({
      className: "",
      initialContent: "",
      placeholder: props.placeholder ?? t("editor.any-thoughts"),
      onContentChange: (content: string) => {
        setHasContent(content !== "");
        saveContentToCache(content);
      },
      onPaste: handlePasteEvent,
      isFocusMode,
      isInIME: isComposing,
      onCompositionStart: handleCompositionStart,
      onCompositionEnd: handleCompositionEnd,
    }),
    [i18n.language, isFocusMode, isComposing, handlePasteEvent, handleCompositionStart, handleCompositionEnd, saveContentToCache],
  );

  const allowSave = (hasContent || attachmentList.length > 0 || localFiles.length > 0) && !isUploadingAttachment && !isRequesting;

  return (
    <MemoEditorContext.Provider
      value={{
        attachmentList,
        relationList,
        setAttachmentList,
        addLocalFiles: (files) => addFiles(Array.from(files.map((f) => f.file))),
        removeLocalFile: removeFile,
        localFiles,
        setRelationList,
        memoName,
      }}
    >
      {/* Focus Mode Backdrop */}
      <FocusModeOverlay isActive={isFocusMode} onToggle={toggleFocusMode} />

      <div
        className={cn(
          "group relative w-full flex flex-col justify-start items-start bg-card px-4 pt-3 pb-2 rounded-lg border",
          FOCUS_MODE_STYLES.transition,
          isDraggingFile ? "border-dashed border-muted-foreground cursor-copy" : "border-border cursor-auto",
          isFocusMode && cn(FOCUS_MODE_STYLES.container.base, FOCUS_MODE_STYLES.container.spacing),
          className,
        )}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        {...dragHandlers}
        onFocus={handleEditorFocus}
      >
        {/* Focus Mode Exit Button */}
        <FocusModeExitButton isActive={isFocusMode} onToggle={toggleFocusMode} title={t("editor.exit-focus-mode")} />

        <Editor ref={editorRef} {...editorConfig} />
        <LocationDisplay mode="edit" location={location} onRemove={() => setLocation(undefined)} />
        {/* Show attachments and pending files together */}
        <AttachmentList
          mode="edit"
          attachments={attachmentList}
          onAttachmentsChange={setAttachmentList}
          localFiles={localFiles}
          onRemoveLocalFile={removeFile}
        />
        <RelationList mode="edit" relations={referenceRelations} onRelationsChange={setRelationList} />
        <div className="relative w-full flex flex-row justify-between items-center pt-2 gap-2" onFocus={(e) => e.stopPropagation()}>
          <div className="flex flex-row justify-start items-center gap-1">
            <InsertMenu
              isUploading={isUploadingAttachment}
              location={location}
              onLocationChange={setLocation}
              onToggleFocusMode={toggleFocusMode}
            />
          </div>
          <div className="shrink-0 flex flex-row justify-end items-center">
            <VisibilitySelector value={memoVisibility} onChange={setMemoVisibility} />
            <div className="flex flex-row justify-end gap-1">
              {props.onCancel && (
                <Button
                  variant="ghost"
                  disabled={isRequesting}
                  onClick={() => {
                    clearFiles();
                    if (props.onCancel) props.onCancel();
                  }}
                >
                  {t("common.cancel")}
                </Button>
              )}
              <Button disabled={!allowSave || isRequesting} onClick={handleSaveBtnClick}>
                {isRequesting ? <LoaderIcon className="w-4 h-4 animate-spin" /> : t("editor.save")}
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
  );
});

export default MemoEditor;
