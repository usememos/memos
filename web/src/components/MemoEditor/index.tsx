import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { memoKeys } from "@/hooks/useMemoQueries";
import { userKeys } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { cn } from "@/lib/utils";
import { InstanceSetting_AIProviderType, InstanceSetting_Key } from "@/types/proto/api/v1/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityFromString } from "@/utils/memo";
import {
  AudioRecorderPanel,
  EditorContent,
  EditorMetadata,
  EditorToolbar,
  FocusModeExitButton,
  FocusModeOverlay,
  TimestampPopover,
} from "./components";
import { FOCUS_MODE_STYLES } from "./constants";
import type { EditorRefActions } from "./Editor";
import { useAudioRecorder, useAutoSave, useFocusMode, useKeyboard, useMemoInit } from "./hooks";
import { errorService, memoService, transcriptionService, validationService } from "./services";
import { EditorProvider, useEditorContext } from "./state";
import type { MemoEditorProps } from "./types";
import type { LocalFile } from "./types/attachment";

const TRANSCRIPTION_PROVIDER_TYPES: InstanceSetting_AIProviderType[] = [
  InstanceSetting_AIProviderType.OPENAI,
  InstanceSetting_AIProviderType.GEMINI,
];

const MemoEditor = (props: MemoEditorProps) => (
  <EditorProvider>
    <MemoEditorImpl {...props} />
  </EditorProvider>
);

const MemoEditorImpl: React.FC<MemoEditorProps> = ({
  className,
  cacheKey,
  memo,
  parentMemoName,
  autoFocus,
  placeholder,
  onConfirm,
  onCancel,
}) => {
  const t = useTranslate();
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const editorRef = useRef<EditorRefActions>(null);
  const { state, actions, dispatch } = useEditorContext();
  const { userGeneralSetting } = useAuth();
  const { aiSetting, fetchSetting } = useInstance();
  const [isAudioRecorderOpen, setIsAudioRecorderOpen] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);

  const memoName = memo?.name;
  const transcriptionProvider = useMemo(
    () => aiSetting.providers.find((provider) => provider.apiKeySet && TRANSCRIPTION_PROVIDER_TYPES.includes(provider.type)),
    [aiSetting.providers],
  );

  // Get default visibility from user settings
  const defaultVisibility = userGeneralSetting?.memoVisibility ? convertVisibilityFromString(userGeneralSetting.memoVisibility) : undefined;

  const { isInitialized } = useMemoInit({ editorRef, memo, cacheKey, username: currentUser?.name ?? "", autoFocus, defaultVisibility });
  const isDraftCacheEnabled = !memo;

  // Auto-save content to localStorage
  const { discardDraft } = useAutoSave(state.content, currentUser?.name ?? "", cacheKey, isInitialized && isDraftCacheEnabled);

  // Focus mode management with body scroll lock
  useFocusMode(state.ui.isFocusMode);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    void fetchSetting(InstanceSetting_Key.AI).catch(() => undefined);
  }, [currentUser, fetchSetting]);

  const insertTranscribedText = useCallback((text: string) => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const content = editor.getContent();
    const cursor = editor.getCursorPosition();
    const beforeCursor = content.slice(0, cursor);
    const afterCursor = content.slice(cursor);
    const prefix = beforeCursor.length === 0 || beforeCursor.endsWith("\n\n") ? "" : beforeCursor.endsWith("\n") ? "\n" : "\n\n";
    const suffix = afterCursor.length === 0 || afterCursor.startsWith("\n\n") ? "" : afterCursor.startsWith("\n") ? "\n" : "\n\n";

    editor.insertText(text, prefix, suffix);
    editor.scrollToCursor();
  }, []);

  const handleTranscribeRecordedAudio = useCallback(
    async (localFile: LocalFile) => {
      if (!transcriptionProvider) {
        dispatch(actions.addLocalFile(localFile));
        setIsTranscribingAudio(false);
        setIsAudioRecorderOpen(false);
        return;
      }

      try {
        const text = (await transcriptionService.transcribeFile(localFile.file, transcriptionProvider)).trim();
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
    [actions, dispatch, insertTranscribedText, t, transcriptionProvider],
  );

  const audioRecorderActions = useMemo(
    () => ({
      setAudioRecorderSupport: (value: boolean) => dispatch(actions.setAudioRecorderSupport(value)),
      setAudioRecorderPermission: (value: "unknown" | "granted" | "denied") => dispatch(actions.setAudioRecorderPermission(value)),
      setAudioRecorderStatus: (value: "idle" | "requesting_permission" | "recording" | "error" | "unsupported") =>
        dispatch(actions.setAudioRecorderStatus(value)),
      setAudioRecorderElapsed: (value: number) => dispatch(actions.setAudioRecorderElapsed(value)),
      setAudioRecorderError: (value?: string) => dispatch(actions.setAudioRecorderError(value)),
      onRecordingComplete: (localFile: LocalFile, mode: "attach" | "transcribe") => {
        if (mode === "transcribe") {
          void handleTranscribeRecordedAudio(localFile);
          return;
        }

        dispatch(actions.addLocalFile(localFile));
        setIsAudioRecorderOpen(false);
      },
      onRecordingEmpty: (mode: "attach" | "transcribe") => {
        if (mode === "transcribe") {
          setIsTranscribingAudio(false);
          toast.error(t("editor.audio-recorder.transcribe-empty"));
        }
        setIsAudioRecorderOpen(false);
      },
    }),
    [actions, dispatch, handleTranscribeRecordedAudio, t],
  );

  const audioRecorder = useAudioRecorder(audioRecorderActions);

  useEffect(() => {
    if (!isAudioRecorderOpen) {
      return;
    }

    if (state.audioRecorder.status === "error" || state.audioRecorder.status === "unsupported") {
      toast.error(state.audioRecorder.error || t("editor.audio-recorder.error-description"));
      setIsAudioRecorderOpen(false);
    }
  }, [isAudioRecorderOpen, state.audioRecorder.error, state.audioRecorder.status, t]);

  const handleToggleFocusMode = () => {
    dispatch(actions.toggleFocusMode());
  };

  const handleStartAudioRecording = async () => {
    setIsAudioRecorderOpen(true);
    await audioRecorder.startRecording();
  };

  const handleAudioRecorderClick = () => {
    if (state.audioRecorder.status === "recording" || state.audioRecorder.status === "requesting_permission") {
      return;
    }

    void handleStartAudioRecording();
  };

  const handleCancelAudioRecording = () => {
    setIsTranscribingAudio(false);
    audioRecorder.resetRecording();
    setIsAudioRecorderOpen(false);
  };

  const handleTranscribeAudioRecording = () => {
    if (!transcriptionProvider || isTranscribingAudio) {
      return;
    }

    setIsTranscribingAudio(true);
    const didStop = audioRecorder.stopRecording("transcribe");
    if (!didStop) {
      setIsTranscribingAudio(false);
    }
  };

  useKeyboard(editorRef, handleSave);

  async function handleSave() {
    // Validate before saving
    const { valid, reason } = validationService.canSave(state);
    if (!valid) {
      toast.error(reason || "Cannot save");
      return;
    }

    dispatch(actions.setLoading("saving", true));

    try {
      const result = await memoService.save(state, { memoName, parentMemoName });

      if (!result.hasChanges) {
        toast.error(t("editor.no-changes-detected"));
        onCancel?.();
        return;
      }

      // Clear localStorage cache on successful save and prevent the unmount
      // flush from writing the just-saved content back as a stale draft.
      discardDraft();

      // Invalidate React Query cache to refresh memo lists across the app
      const invalidationPromises = [
        queryClient.invalidateQueries({ queryKey: memoKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: userKeys.stats() }),
      ];

      // Ensure memo detail pages don't keep stale cached content after edits.
      if (memoName) {
        invalidationPromises.push(queryClient.invalidateQueries({ queryKey: memoKeys.detail(memoName) }));
      }

      // If this was a comment, also invalidate the comments query for the parent memo
      if (parentMemoName) {
        invalidationPromises.push(queryClient.invalidateQueries({ queryKey: memoKeys.comments(parentMemoName) }));
      }

      await Promise.all(invalidationPromises);

      // Reset editor state to initial values
      dispatch(actions.reset());
      if (!memoName && defaultVisibility) {
        dispatch(actions.setMetadata({ visibility: defaultVisibility }));
      }

      // Notify parent component of successful save
      onConfirm?.(result.memoName);
    } catch (error) {
      handleError(error, toast.error, {
        context: "Failed to save memo",
        fallbackMessage: errorService.getErrorMessage(error),
      });
    } finally {
      dispatch(actions.setLoading("saving", false));
    }
  }

  return (
    <>
      <FocusModeOverlay isActive={state.ui.isFocusMode} onToggle={handleToggleFocusMode} />

      {/*
        Layout structure:
        - Uses justify-between to push content to top and bottom
        - In focus mode: becomes fixed with specific spacing, editor grows to fill space
        - In normal mode: stays relative with max-height constraint
      */}
      <div
        className={cn(
          "group relative w-full flex flex-col justify-between items-start bg-card px-4 pt-3 pb-1 rounded-lg border border-border gap-2",
          FOCUS_MODE_STYLES.transition,
          state.ui.isFocusMode && cn(FOCUS_MODE_STYLES.container.base, FOCUS_MODE_STYLES.container.spacing),
          className,
        )}
      >
        {/* Exit button is absolutely positioned in top-right corner when active */}
        <FocusModeExitButton isActive={state.ui.isFocusMode} onToggle={handleToggleFocusMode} title={t("editor.exit-focus-mode")} />

        {memoName && (
          <div className="w-full -mb-1">
            <TimestampPopover />
          </div>
        )}

        {/* Editor content grows to fill available space in focus mode */}
        <EditorContent ref={editorRef} placeholder={placeholder} />

        {isAudioRecorderOpen &&
          (state.audioRecorder.status === "recording" || state.audioRecorder.status === "requesting_permission" || isTranscribingAudio) && (
            <AudioRecorderPanel
              audioRecorder={state.audioRecorder}
              mediaStream={audioRecorder.recordingStream}
              onStop={audioRecorder.stopRecording}
              onCancel={handleCancelAudioRecording}
              onTranscribe={handleTranscribeAudioRecording}
              canTranscribe={!!transcriptionProvider}
              isTranscribing={isTranscribingAudio}
            />
          )}

        {/* Metadata and toolbar grouped together at bottom */}
        <div className="w-full flex flex-col gap-2">
          <EditorMetadata memoName={memoName} />
          <EditorToolbar onSave={handleSave} onCancel={onCancel} memoName={memoName} onAudioRecorderClick={handleAudioRecorderClick} />
        </div>
      </div>
    </>
  );
};

export default MemoEditor;
