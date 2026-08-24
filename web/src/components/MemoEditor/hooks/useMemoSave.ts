import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "react-hot-toast";
import { useNewMemo } from "@/contexts/NewMemoContext";
import { attachmentKeys } from "@/hooks/useAttachmentQueries";
import { memoKeys } from "@/hooks/useMemoQueries";
import { userKeys } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import type { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { errorService, memoService, validationService } from "../services";
import { useEditorContext } from "../state";

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
 * Owns the editor's save transaction and its post-save cache/state updates.
 * Keeping this workflow outside the shell makes saving identical whether it is
 * triggered by the toolbar or the editor keyboard shortcut.
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
  const { markNewMemo } = useNewMemo();
  const { actions, dispatch, getState } = useEditorContext();

  return useCallback(async () => {
    const state = getState();
    const { valid, reason, detail } = validationService.canSave(state);
    if (!valid) {
      toast.error(reason ? t(reason, detail ? { url: detail } : undefined) : t("editor.validation.cannot-save"));
      return;
    }

    dispatch(actions.setLoading("saving", true));

    try {
      const result = await memoService.save(state, { memoName, parentMemoName, space: defaultSpace });

      if (!result.hasChanges) {
        toast.error(t("editor.no-changes-detected"));
        onCancel?.();
        return;
      }

      // Prevent the autosave unmount flush from restoring the saved draft.
      discardDraft();

      const invalidationPromises = [
        queryClient.invalidateQueries({ queryKey: memoKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: userKeys.stats() }),
        queryClient.invalidateQueries({ queryKey: attachmentKeys.lists() }),
      ];
      if (memoName) {
        invalidationPromises.push(queryClient.invalidateQueries({ queryKey: memoKeys.detail(memoName) }));
      }
      if (parentMemoName) {
        invalidationPromises.push(queryClient.invalidateQueries({ queryKey: memoKeys.comments(parentMemoName) }));
      }
      await Promise.all(invalidationPromises);

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
      }
      onConfirm?.(result.memoName);
    } catch (error) {
      handleError(error, toast.error, {
        context: "Failed to save memo",
        fallbackMessage: errorService.getErrorMessage(error),
      });
    } finally {
      dispatch(actions.setLoading("saving", false));
    }
  }, [
    actions,
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
  ]);
}
