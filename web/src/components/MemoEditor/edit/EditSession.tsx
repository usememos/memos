import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useSourceMode } from "@/hooks/useSourceMode";
import { cn } from "@/lib/utils";
import { InstanceSetting_Key } from "@/types/proto/api/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityFromString } from "@/utils/memo";

import { AudioRecorderPanel, EditorContent, EditorMetadata, FocusModeExitButton, FocusModeOverlay, TimestampPopover } from "./components";
import { EditorSuggestions } from "./components/EditorSuggestions";
import { FOCUS_MODE_STYLES } from "./constants";
import type { EditorFileOrigin } from "./extensions";
import {
  splitInlineLocalFiles,
  toLocalFiles,
  useAttachmentTranscription,
  useAudioRecorder,
  useAutoSave,
  useBlobUrls,
  useFocusMode,
  useInlineImageUpload,
  useMemoInit,
  useMemoSave,
} from "./hooks";
import { canChooseSpaceFor } from "./initialState";
import { cacheService, errorService, transcriptionService } from "./services";
import { useEditorContext, useEditorSelector } from "./state";
import { EditorToolbar } from "./Toolbar";
import type { EditorViewToggles, EditSessionProps } from "./types";
import type { LocalFile } from "./types/attachment";
import type { EditorController, EditorPosition } from "./types/editorController";

/**
 * An editing session over the draft store MemoEditor provides: the editor with the
 * composer's chrome around it (timestamp, attachments, suggestions, toolbar, focus
 * mode, audio recording), the draft persisted while it is open, and the save that
 * writes the memo through the memo mutations. A host that presents the editor
 * full-screen supplies `onFocusModeExit`; its presence is what makes an instance
 * hosted, so focus mode starts on and stays on.
 */
export const EditSession: React.FC<EditSessionProps> = ({
  className,
  draftKey,
  frameless,
  memo,
  parentMemoName,
  suggestions = [],
  defaultSpace,
  autoFocus,
  onFocusModeExit,
  onFocusModeChange,
  placeholder,
  defaultCreateTime,
  onConfirm,
  onCancel,
  onSavingChange,
}) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const editorRef = useRef<EditorController>(null);
  const { actions, dispatch, getState } = useEditorContext();
  // Subscribe only to the low-frequency slices this component renders from, so
  // typing (which changes content) does not re-render the editor shell and its
  // toolbar/metadata children.
  const isFocusMode = useEditorSelector((s) => s.ui.isFocusMode);
  // Report focus-mode changes so a host can react; inline hosts pass nothing.
  useEffect(() => {
    onFocusModeChange?.(isFocusMode);
  }, [isFocusMode, onFocusModeChange]);
  const isSaving = useEditorSelector((s) => s.ui.isLoading.saving);
  const hasTimestamp = useEditorSelector((s) => Boolean(s.timestamps.createTime));
  const { userGeneralSetting } = useAuth();
  const { aiSetting, fetchSetting } = useInstance();
  const [isAudioRecorderOpen, setIsAudioRecorderOpen] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const { createBlobUrl } = useBlobUrls();
  const saveMediaMetadata = userGeneralSetting?.saveMediaMetadata ?? false;
  const inlineImageUpload = useInlineImageUpload(editorRef);

  const memoName = memo?.name;
  const showTimestamp = Boolean(memoName || (!memo && hasTimestamp));
  // Replies are never placed independently: a comment's Space is its parent's.
  // An edited top-level memo can change its Space; a new one can unless its
  // host fixes the target (e.g. composing inside a Space).
  const draftSpace = useEditorSelector((s) => s.metadata.space);
  const canChooseSpace = canChooseSpaceFor({ memo, currentUser, parentMemoName, defaultSpace });
  const editorSpace = memo ? draftSpace : parentMemoName ? undefined : (defaultSpace ?? draftSpace);
  const canTranscribe = useMemo(() => {
    const providerId = aiSetting.transcription?.providerId ?? "";
    if (!providerId) return false;
    const provider = aiSetting.providers.find((p) => p.id === providerId);
    return Boolean(provider?.apiKeySet);
  }, [aiSetting.providers, aiSetting.transcription?.providerId]);

  // Get default visibility from user settings
  const defaultVisibility = userGeneralSetting?.memoVisibility ? convertVisibilityFromString(userGeneralSetting.memoVisibility) : undefined;

  // Source mode only changes how the text is edited, so every composer offers it.
  const [editorMode, setEditorMode] = useSourceMode();
  const isSourceMode = editorMode === "source";
  const sourceMode = { isSourceMode, onToggle: () => setEditorMode(isSourceMode ? "rich" : "source") };

  const { isInitialized } = useMemoInit({ editorRef, draftKey, autoFocus, mode: editorMode });
  // An edit starts from the memo and never persists a draft; only new memos and comments do.
  const isDraftCacheEnabled = !memo;

  useEffect(() => {
    onSavingChange?.(isSaving);
  }, [isSaving, onSavingChange]);

  // Auto-save content to localStorage (subscribes to the store internally).
  const { discardDraft } = useAutoSave(draftKey, isInitialized && isDraftCacheEnabled);

  const { containerRef: editorContainerRef, placeholderHeight, animateFocusMode } = useFocusMode(isFocusMode);

  // Live-sync the draft's createTime/updateTime to the calendar-derived prop.
  // Only applies in create mode; edit mode owns its own timestamps. Runs after
  // initial mount (the seed value is set in useMemoInit), and again whenever
  // the prop changes — e.g., when the user picks a different calendar date
  // while the editor is open.
  useEffect(() => {
    if (memo) return;
    if (!isInitialized) return;
    dispatch(
      actions.setTimestamps({
        createTime: defaultCreateTime,
        updateTime: defaultCreateTime,
      }),
    );
  }, [defaultCreateTime, memo, isInitialized, actions, dispatch]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    void fetchSetting(InstanceSetting_Key.AI).catch(() => undefined);
  }, [currentUser, fetchSetting]);

  const insertTranscribedText = useCallback((text: string) => editorRef.current?.insertMarkdown(text), []);

  const { transcribeAttachment, transcribingAttachment } = useAttachmentTranscription(insertTranscribedText);

  const handleTranscribeRecordedAudio = useCallback(
    async (localFile: LocalFile) => {
      if (!canTranscribe) {
        dispatch(actions.addLocalFile(localFile));
        setIsTranscribingAudio(false);
        setIsAudioRecorderOpen(false);
        return;
      }

      try {
        const text = (await transcriptionService.transcribeFile(localFile.file)).trim();
        if (!text) {
          dispatch(actions.addLocalFile(localFile));
          toast.error(t("editor.audio-recorder.transcribe-empty"));
          return;
        }

        insertTranscribedText(text);
        toast.success(t("editor.audio-recorder.transcribe-success"));
      } catch (error) {
        console.error(error);
        toast.error(errorService.getErrorMessage(error) || t("editor.audio-recorder.transcribe-error"));
        dispatch(actions.addLocalFile(localFile));
      } finally {
        setIsTranscribingAudio(false);
        setIsAudioRecorderOpen(false);
      }
    },
    [actions, canTranscribe, dispatch, insertTranscribedText, t],
  );

  const audioRecorder = useAudioRecorder({
    onRecordingComplete: (localFile, mode) => {
      if (mode === "transcribe") {
        void handleTranscribeRecordedAudio(localFile);
        return;
      }

      dispatch(actions.addLocalFile(localFile));
      setIsAudioRecorderOpen(false);
    },
    onRecordingEmpty: (mode) => {
      if (mode === "transcribe") {
        setIsTranscribingAudio(false);
        toast.error(t("editor.audio-recorder.transcribe-empty"));
      }
      setIsAudioRecorderOpen(false);
    },
  });

  // Mirror the recorder's busy state into the store so validationService.canSave
  // (consumed here and by EditorToolbar) can block saves mid-recording without
  // the reducer owning the recorder's full state.
  useEffect(() => {
    dispatch(actions.setRecorderBusy(audioRecorder.isBusy));
  }, [audioRecorder.isBusy, actions, dispatch]);

  // Both transcription paths insert into the draft when they land, so saving
  // waits for either one; the recorder itself is idle by then.
  useEffect(() => {
    dispatch(actions.setLoading("transcribing", isTranscribingAudio || Boolean(transcribingAttachment)));
  }, [isTranscribingAudio, transcribingAttachment, actions, dispatch]);

  useEffect(() => {
    if (!isAudioRecorderOpen) {
      return;
    }

    if (audioRecorder.status === "error" || audioRecorder.status === "unsupported") {
      toast.error(audioRecorder.error || t("editor.audio-recorder.error-description"));
      setIsAudioRecorderOpen(false);
    }
  }, [isAudioRecorderOpen, audioRecorder.error, audioRecorder.status, t]);

  const rememberCursor = useCallback(() => {
    const cursor = editorRef.current?.getSelection();
    if (cursor !== undefined) {
      cacheService.saveCursor(draftKey, cursor, editorMode);
    }
  }, [draftKey, editorMode]);

  // Hosted: focus mode is the host's frame, so leaving it dismisses the host.
  // Inline: focus mode is a view this editor owns and toggles in place.
  const handleToggleFocusMode = () => {
    if (onFocusModeExit) {
      rememberCursor();
      onFocusModeExit();
      return;
    }
    animateFocusMode(() => dispatch(actions.toggleFocusMode()));
  };

  const handleCancel = useCallback(() => {
    rememberCursor();
    onCancel?.();
  }, [onCancel, rememberCursor]);

  const handleStartAudioRecording = async () => {
    setIsAudioRecorderOpen(true);
    await audioRecorder.startRecording();
  };

  const handleAudioRecorderClick = () => {
    if (audioRecorder.isBusy) {
      return;
    }

    void handleStartAudioRecording();
  };

  /**
   * Single ingest point for files the editor receives. Inline placement writes
   * images into the text (at `position`, else the caret) and attaches the rest;
   * otherwise everything joins the attachment list.
   */
  const handleFiles = useCallback(
    (files: File[], placement: { inline: false } | { inline: true; position?: EditorPosition | null }) => {
      if (getState().ui.isLoading.saving) return;
      const localFiles = toLocalFiles(files, { createBlobUrl, saveMediaMetadata });
      const { inline, attachments } = placement.inline ? splitInlineLocalFiles(localFiles) : { inline: [], attachments: localFiles };
      attachments.forEach((file) => dispatch(actions.addLocalFile(file)));
      if (placement.inline) inlineImageUpload.insertLocalImages(inline, placement.position);
    },
    [actions, createBlobUrl, dispatch, getState, inlineImageUpload.insertLocalImages, saveMediaMetadata],
  );

  /** The ＋ menu's Insert image: inline at the caret. */
  const handleInsertImages = useCallback((files: File[]) => handleFiles(files, { inline: true }), [handleFiles]);

  /**
   * A drop inlines images where they landed. A paste carries no placement
   * gesture, so it attaches like the ＋ menu's upload; the attachment list's
   * own Insert action is how a pasted image becomes inline.
   */
  const handleEditorFiles = useCallback(
    (files: File[], origin: EditorFileOrigin) =>
      handleFiles(files, origin.source === "drop" ? { inline: true, position: origin.position } : { inline: false }),
    [handleFiles],
  );

  const handleCancelAudioRecording = () => {
    setIsTranscribingAudio(false);
    audioRecorder.resetRecording();
    setIsAudioRecorderOpen(false);
  };

  const handleTranscribeAudioRecording = () => {
    if (!canTranscribe || isTranscribingAudio) {
      return;
    }

    setIsTranscribingAudio(true);
    const didStop = audioRecorder.stopRecording("transcribe");
    if (!didStop) {
      setIsTranscribingAudio(false);
    }
  };

  // The ＋ menu's view toggle only describes how an inline editor presents
  // itself, so a hosted editor does not offer it: its host owns the frame.
  const viewToggles: EditorViewToggles | undefined = onFocusModeExit
    ? undefined
    : {
        onToggleFocusMode: handleToggleFocusMode,
      };

  const handleSave = useMemoSave({
    memoName,
    parentMemoName,
    defaultSpace,
    defaultVisibility,
    defaultCreateTime,
    discardDraft,
    onConfirm,
    onCancel: onCancel ? handleCancel : undefined,
  });

  return (
    <>
      <FocusModeOverlay isActive={isFocusMode} onToggle={handleToggleFocusMode} />

      {/*
        Layout structure:
        - Uses justify-between to push content to top and bottom
        - In focus mode: becomes fixed with specific spacing, editor grows to fill space
        - In normal mode: stays relative with max-height constraint
      */}
      {isFocusMode && placeholderHeight > 0 && (
        <div aria-hidden className={cn("w-full", className)} style={{ height: placeholderHeight }} />
      )}

      <div
        ref={editorContainerRef}
        className={cn(
          "group relative w-full flex flex-col justify-between items-start gap-2",
          // A card that is the frame already supplies the background, border and padding; a
          // session floating over the page in focus mode always brings its own.
          (!frameless || isFocusMode) && "bg-card px-4 py-3 rounded-lg border border-border/70",
          isFocusMode && cn(FOCUS_MODE_STYLES.container.base, FOCUS_MODE_STYLES.container.spacing),
          !isFocusMode && className,
        )}
      >
        {isSourceMode && (
          <span
            className={cn(
              "pointer-events-none absolute end-0 top-0 rounded-es-lg rounded-se-lg border-s border-b border-border/70 bg-muted/40 px-1.5 py-1 select-none font-mono text-[10px] font-medium leading-3 text-muted-foreground [text-box:trim-both_cap_alphabetic]",
              isFocusMode && "border-border py-px leading-none",
            )}
            aria-label={t("editor.markdown-mode")}
          >
            Markdown
          </span>
        )}
        {/* Formatting is the editor's own: its toolbar appears over selected
            text, and the slash menu and Markdown shortcuts change block types.
            Focus mode always shows the memo's time ("Now" before it has one) and adds
            the button that leaves the current frame — minimize inline, close when hosted. */}
        {(showTimestamp || isFocusMode) && (
          <div className={cn("flex w-full items-center", isFocusMode ? "h-10" : "h-6")}>
            <TimestampPopover />
            {isFocusMode && (
              <div className="ms-auto -me-2">
                <FocusModeExitButton action={onFocusModeExit ? "close" : "minimize"} onExit={handleToggleFocusMode} />
              </div>
            )}
          </div>
        )}

        {/* Editor content grows to fill available space in focus mode */}
        <EditorContent
          ref={editorRef}
          placeholder={placeholder}
          sourceMode={sourceMode}
          onSubmit={handleSave}
          onFiles={handleEditorFiles}
        />

        {isAudioRecorderOpen && (audioRecorder.isBusy || isTranscribingAudio) && (
          <AudioRecorderPanel
            audioRecorder={{ status: audioRecorder.status, elapsedSeconds: audioRecorder.elapsedSeconds }}
            mediaStream={audioRecorder.recordingStream}
            onStop={audioRecorder.stopRecording}
            onCancel={handleCancelAudioRecording}
            onTranscribe={handleTranscribeAudioRecording}
            canTranscribe={canTranscribe}
            isTranscribing={isTranscribingAudio}
          />
        )}

        {/* Metadata and toolbar grouped together at bottom */}
        <div className="w-full flex flex-col gap-2">
          <EditorMetadata
            memoName={memoName}
            uploadingLocalFileURLs={inlineImageUpload.uploadingLocalFileURLs}
            onInsertAttachments={inlineImageUpload.insertRemoteImages}
            onInsertLocalFiles={inlineImageUpload.insertLocalImages}
            onTranscribeAttachment={canTranscribe ? transcribeAttachment : undefined}
            transcribingAttachment={transcribingAttachment}
            transcriptionDisabled={isSaving || audioRecorder.isBusy || isTranscribingAudio}
          />
          {!memo && !parentMemoName && isInitialized && suggestions.length > 0 && (
            <EditorSuggestions suggestions={suggestions} controllerRef={editorRef} space={editorSpace} />
          )}
          <EditorToolbar
            onSave={handleSave}
            onCancel={onCancel ? handleCancel : undefined}
            memoName={memoName}
            parentMemoName={parentMemoName}
            space={editorSpace}
            canChooseSpace={canChooseSpace}
            onAudioRecorderClick={handleAudioRecorderClick}
            viewToggles={viewToggles}
            sourceMode={sourceMode}
            onInsertImages={handleInsertImages}
          />
        </div>
      </div>
    </>
  );
};
