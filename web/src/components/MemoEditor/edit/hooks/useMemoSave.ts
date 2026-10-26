import { Code, ConnectError } from "@connectrpc/connect";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "react-hot-toast";
import { useNewMemo } from "@/contexts/NewMemoContext";
import { attachmentKeys } from "@/hooks/useAttachmentQueries";
import { memoDetailQueryOptions, useCreateMemo, useUpdateMemo } from "@/hooks/useMemoQueries";
import { userKeys } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import type { Attachment } from "@/types/proto/api/attachment_service_pb";
import type { Visibility } from "@/types/proto/api/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { errorService, memoService, validationService } from "../services";
import type { MemoSaveOperations } from "../services/memoService";
import { useEditorContext } from "../state";
import { restampDefaultCreateTime } from "../utils/deriveDefaultCreateTime";

/** How long a closing host shows "Saved" before it unmounts the editor. */
const SAVED_CONFIRMATION_MS = 900;

interface UseMemoSaveOptions {
  memoName?: string;
  parentMemoName?: string;
  defaultSpace?: string;
  defaultVisibility?: Visibility;
  defaultCreateTime?: Date;
  discardDraft: () => void;
  onConfirm?: (memoName: string) => void;
  onCancel?: () => void;
}

/**
 * Owns the editor's save transaction and its post-save state. The memo itself is
 * written through the memo mutation hooks, which patch and refresh every query that
 * holds it, so the saved text shows wherever the memo is on the page as soon as the
 * server answers. Saving is identical whether the toolbar or the keyboard triggers it.
 */
export function useMemoSave({
  memoName,
  parentMemoName,
  defaultSpace,
  defaultVisibility,
  defaultCreateTime,
  discardDraft,
  onConfirm,
  onCancel,
}: UseMemoSaveOptions): () => Promise<void> {
  const t = useTranslate();
  const queryClient = useQueryClient();
  const { mutateAsync: createMemo } = useCreateMemo();
  const { mutateAsync: updateMemo } = useUpdateMemo();
  const { markNewMemo } = useNewMemo();
  const { actions, dispatch, getState } = useEditorContext();

  return useCallback(async () => {
    const state = getState();
    // A repeated shortcut during the saved confirmation is not an error worth
    // a toast; the save already landed and the host is closing.
    if (state.ui.justSaved) return;
    const { valid, reason, detail } = validationService.canSave(state);
    if (!valid) {
      toast.error(reason ? t(reason, detail ? { url: detail } : undefined) : t("editor.validation.cannot-save"));
      return;
    }

    dispatch(actions.setLoading("saving", true));

    // Files that finished uploading, keyed by preview URL. If the save fails
    // after they uploaded, they move onto the draft as attachments so that a
    // retry does not upload them again (a refused create would otherwise leak
    // one copy per attempt into the user's storage).
    const uploaded = new Map<string, Attachment>();
    const keepUploadedFiles = () => {
      if (uploaded.size === 0) return;
      const current = getState();
      const moved = current.localFiles.filter((file) => uploaded.has(file.previewUrl));
      if (moved.length === 0) return;
      dispatch(
        actions.setMetadata({
          attachments: [...current.metadata.attachments, ...moved.map((file) => uploaded.get(file.previewUrl) as Attachment)],
        }),
      );
      dispatch(actions.setLocalFiles(current.localFiles.filter((file) => !uploaded.has(file.previewUrl))));
    };

    const operations: MemoSaveOperations = {
      // The server's current copy, fetched afresh into the detail cache.
      getMemo: async (name) => {
        const memo = await queryClient.fetchQuery({ ...memoDetailQueryOptions(name), staleTime: 0 });
        if (!memo) throw new ConnectError("memo not found", Code.NotFound);
        return memo;
      },
      updateMemo: (update, updateMask) => updateMemo({ update, updateMask }),
      createMemo: (memo, parent) => createMemo({ memo, parent }),
    };

    try {
      // A new memo composed on a selected day keeps the day but is stamped with
      // the time of saving, so consecutive memos do not share one createTime.
      const now = new Date();
      const timestamps = memoName
        ? state.timestamps
        : {
            createTime: restampDefaultCreateTime(state.timestamps.createTime, defaultCreateTime, now),
            updateTime: restampDefaultCreateTime(state.timestamps.updateTime, defaultCreateTime, now),
          };
      const result = await memoService.save(
        { ...state, timestamps },
        {
          memoName,
          parentMemoName,
          space: defaultSpace,
          onFileUploaded: (file, attachment) => uploaded.set(file.previewUrl, attachment),
        },
        operations,
      );

      if (!result.hasChanges) {
        toast.error(t("editor.no-changes-detected"));
        onCancel?.();
        return;
      }

      // Prevent the autosave unmount flush from restoring the saved draft.
      discardDraft();
      // A moved memo may leave the feed it was edited in; say where it went.
      if (result.moved) {
        toast.success(t("memo.moved"));
      }

      // Hosts that close after saving (edit, comment) hold a brief "Saved"
      // confirmation on the toolbar while the caches refresh underneath. The
      // in-place composer clears immediately, so it shows nothing.
      if (memoName || parentMemoName) {
        dispatch(actions.setLoading("saving", false));
        dispatch(actions.setJustSaved(true));
        await new Promise((resolve) => setTimeout(resolve, SAVED_CONFIRMATION_MS));
      }

      dispatch(actions.reset());
      if (!memoName && defaultVisibility) {
        dispatch(actions.setMetadata({ visibility: defaultVisibility }));
      }
      // Reset creates a fresh editor state, so restore calendar-derived values
      // for the next memo created without remounting this composer.
      if (!memoName && defaultCreateTime) {
        dispatch(actions.setTimestamps({ createTime: defaultCreateTime, updateTime: defaultCreateTime }));
      }

      if (!memoName && !parentMemoName) {
        markNewMemo(result.memoName);
      } else if (memoName) {
        markNewMemo((currentName) => (currentName === memoName ? null : currentName));
      }
      onConfirm?.(result.memoName);
    } catch (error) {
      keepUploadedFiles();
      if (uploaded.size > 0) {
        // The uploads landed even though the save did not.
        void queryClient.invalidateQueries({ queryKey: attachmentKeys.lists() });
        void queryClient.invalidateQueries({ queryKey: userKeys.stats() });
      }
      handleError(error, toast.error, {
        context: "Failed to save memo",
        fallbackMessage: errorService.getErrorMessage(error),
      });
    } finally {
      dispatch(actions.setLoading("saving", false));
      dispatch(actions.setJustSaved(false));
    }
  }, [
    actions,
    createMemo,
    defaultCreateTime,
    defaultSpace,
    defaultVisibility,
    discardDraft,
    dispatch,
    getState,
    markNewMemo,
    memoName,
    onCancel,
    onConfirm,
    parentMemoName,
    queryClient,
    t,
    updateMemo,
  ]);
}
