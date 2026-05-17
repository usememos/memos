import { timestampDate } from "@bufbuild/protobuf/wkt";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { memoServiceClient } from "@/connect";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { memoKeys, useDrafts } from "@/hooks/useMemoQueries";
import { userKeys } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { cn } from "@/lib/utils";
import { InstanceSetting_Key } from "@/types/proto/api/v1/instance_service_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
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

// Scrollable, infinitely-paginated drafts list rendered inside the toolbar's
// "load previous drafts" DropdownMenuContent. Infinite scroll is driven by an
// IntersectionObserver sentinel scoped to THIS fixed-height scroll box (the
// window-scroll PagedMemoList cannot drive a fixed container, so it is not
// reused here). Internal (non-exported) — not a new public component/route.
const DraftsListMenu = ({ onSelect }: { onSelect: (draft: Memo) => void }) => {
  const t = useTranslate();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useDrafts({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const drafts = useMemo(() => (data?.pages ?? []).flatMap((page) => page.memos), [data]);

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { root, rootMargin: "0px 0px 80px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div ref={scrollRef} className="max-h-[60vh] overflow-y-auto p-1">
      {isLoading ? (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">{t("editor.loading")}</div>
      ) : drafts.length === 0 ? (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">{t("editor.no-drafts")}</div>
      ) : (
        <>
          {drafts.map((draft) => {
            const firstLine = draft.content.split("\n").find((line) => line.trim()) ?? "";
            const updated = draft.updateTime ? timestampDate(draft.updateTime).toLocaleString() : "";
            return (
              <DropdownMenuItem key={draft.name} className="flex flex-col items-start gap-0.5" onSelect={() => onSelect(draft)}>
                <span className="w-full truncate text-sm">{firstLine || draft.name}</span>
                {updated && <span className="text-xs text-muted-foreground">{updated}</span>}
              </DropdownMenuItem>
            );
          })}
          <div ref={sentinelRef} />
          {isFetchingNextPage && <div className="px-2 py-1.5 text-xs text-muted-foreground">{t("editor.loading")}</div>}
        </>
      )}
    </div>
  );
};

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
  defaultCreateTime,
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
  // Name of a server draft resumed into this editor (O3: fetch-into-fresh-
  // editor, NOT tracked on EditorState). Re-saving passes it as
  // saveDraft's draftMemoName so the same draft is updated, not duplicated.
  const [resumedDraftName, setResumedDraftName] = useState<string | undefined>(undefined);

  const memoName = memo?.name;
  const canTranscribe = useMemo(() => {
    const providerId = aiSetting.transcription?.providerId ?? "";
    if (!providerId) return false;
    const provider = aiSetting.providers.find((p) => p.id === providerId);
    return Boolean(provider?.apiKeySet);
  }, [aiSetting.providers, aiSetting.transcription?.providerId]);

  // Get default visibility from user settings
  const defaultVisibility = userGeneralSetting?.memoVisibility ? convertVisibilityFromString(userGeneralSetting.memoVisibility) : undefined;

  const { isInitialized } = useMemoInit({
    editorRef,
    memo,
    cacheKey,
    username: currentUser?.name ?? "",
    autoFocus,
    defaultVisibility,
    defaultCreateTime,
  });
  const isDraftCacheEnabled = !memo;

  // Auto-save content to localStorage
  const { discardDraft } = useAutoSave(state.content, currentUser?.name ?? "", cacheKey, isInitialized && isDraftCacheEnabled);

  // Focus mode management with body scroll lock
  useFocusMode(state.ui.isFocusMode);

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
    if (!canTranscribe || isTranscribingAudio) {
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
      // Publishing a resumed draft must transition that SAME draft row
      // (DRAFT -> NORMAL) — not mint a new NORMAL memo, which would duplicate
      // it onto Home and leave the draft stranded in the Drafts list. Only
      // applies in the create-mode composer (no memoName, not a comment).
      const isPublishingResumedDraft = Boolean(resumedDraftName) && !memoName && !parentMemoName;
      const result = isPublishingResumedDraft
        ? { ...(await memoService.publishDraft(state, { draftMemoName: resumedDraftName! })), hasChanges: true }
        : await memoService.save(state, { memoName, parentMemoName });

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

      // A resumed draft is now published and detached from this editor.
      setResumedDraftName(undefined);

      // Reset editor state to initial values
      dispatch(actions.reset());
      if (!memoName && defaultVisibility) {
        dispatch(actions.setMetadata({ visibility: defaultVisibility }));
      }
      // Re-seed the calendar-derived timestamps so the popover stays visible
      // and subsequent memos in the same filter session keep the prefilled date.
      // Without this, the live-sync effect won't re-fire (its deps don't change
      // across reset), and memo #2 onward would silently fall back to "now".
      if (!memoName && defaultCreateTime) {
        dispatch(actions.setTimestamps({ createTime: defaultCreateTime, updateTime: defaultCreateTime }));
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

  // Server-side draft save (sibling of handleSave). Unlike handleSave it does
  // NOT gate on validationService.canSave — a draft may be empty/partial (E4).
  async function handleSaveDraft() {
    dispatch(actions.setLoading("saving", true));

    try {
      await memoService.saveDraft(state, {
        draftMemoName: resumedDraftName,
        username: currentUser?.name,
        cacheKey,
      });

      // Clear the localStorage keystroke buffer + suppress the unmount flush so
      // it cannot stale-restore over the just-saved server draft (edge E7).
      discardDraft();

      // Same invalidation set as handleSave. memoKeys.lists() also covers the
      // useDrafts query (it shares memoKeys.list(...)), so the drafts list
      // refreshes for free.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: memoKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: userKeys.stats() }),
      ]);

      // Reset the editor like a successful save; a resumed draft is now
      // detached from this editor instance.
      setResumedDraftName(undefined);
      dispatch(actions.reset());
      if (defaultVisibility) {
        dispatch(actions.setMetadata({ visibility: defaultVisibility }));
      }
      if (defaultCreateTime) {
        dispatch(actions.setTimestamps({ createTime: defaultCreateTime, updateTime: defaultCreateTime }));
      }

      toast.success(t("editor.save-as-draft"));
    } catch (error) {
      handleError(error, toast.error, {
        context: "Failed to save draft",
        fallbackMessage: errorService.getErrorMessage(error),
      });
    } finally {
      dispatch(actions.setLoading("saving", false));
    }
  }

  // Resume a draft: fetch it by name and hydrate the editor reducer the same
  // way an existing memo is loaded (memoService.fromMemo + initMemo). EditorState
  // is NOT extended (O3); the draft's name is tracked in component-local state.
  const handleResumeDraft = useCallback(
    async (draft: Memo) => {
      try {
        // Route through the React Query layer (shared memoKeys.detail cache)
        // rather than calling the connect client directly from the component.
        const full = await queryClient.fetchQuery({
          queryKey: memoKeys.detail(draft.name),
          queryFn: () => memoServiceClient.getMemo({ name: draft.name }),
        });
        dispatch(actions.initMemo(memoService.fromMemo(full)));
        setResumedDraftName(full.name);
      } catch (error) {
        handleError(error, toast.error, {
          context: "Failed to load draft",
          fallbackMessage: errorService.getErrorMessage(error),
        });
      }
    },
    [actions, dispatch, queryClient],
  );

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

        {(memoName || (!memo && state.timestamps.createTime)) && (
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
              canTranscribe={canTranscribe}
              isTranscribing={isTranscribingAudio}
            />
          )}

        {/* Metadata and toolbar grouped together at bottom */}
        <div className="w-full flex flex-col gap-2">
          <EditorMetadata memoName={memoName} />
          <EditorToolbar
            onSave={handleSave}
            onCancel={onCancel}
            memoName={memoName}
            onAudioRecorderClick={handleAudioRecorderClick}
            onSaveDraft={isDraftCacheEnabled && !parentMemoName ? handleSaveDraft : undefined}
            onLoadDrafts={
              isDraftCacheEnabled && !parentMemoName
                ? () => <DraftsListMenu onSelect={(draft) => void handleResumeDraft(draft)} />
                : undefined
            }
          />
        </div>
      </div>
    </>
  );
};

export default MemoEditor;
