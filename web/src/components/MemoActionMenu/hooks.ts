import { useQueryClient } from "@tanstack/react-query";
import copy from "copy-to-clipboard";
import { useCallback } from "react";
import toast from "react-hot-toast";
import { useLocation } from "react-router-dom";
import { useInstance } from "@/contexts/InstanceContext";
import { useDeleteMemo, useUpdateMemo } from "@/hooks/useMemoQueries";
import useNavigateTo from "@/hooks/useNavigateTo";
import { userKeys } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

interface UseMemoActionHandlersOptions {
  memo: Memo;
  onEdit?: () => void;
  setDeleteDialogOpen: (open: boolean) => void;
}

export const useMemoActionHandlers = ({ memo, onEdit, setDeleteDialogOpen }: UseMemoActionHandlersOptions) => {
  const t = useTranslate();
  const location = useLocation();
  const navigateTo = useNavigateTo();
  const queryClient = useQueryClient();
  const { profile } = useInstance();
  const { mutateAsync: updateMemo } = useUpdateMemo();
  const { mutateAsync: deleteMemo } = useDeleteMemo();
  const isInMemoDetailPage = location.pathname.startsWith(`/${memo.name}`);

  const memoUpdatedCallback = useCallback(() => {
    // Invalidate user stats to trigger refetch
    queryClient.invalidateQueries({ queryKey: userKeys.stats() });
  }, [queryClient]);

  const handleTogglePinMemoBtnClick = useCallback(async () => {
    try {
      await updateMemo({
        update: {
          name: memo.name,
          pinned: !memo.pinned,
        },
        updateMask: ["pinned"],
      });
    } catch {
      // do nothing
    }
  }, [memo.name, memo.pinned, updateMemo]);

  const handleEditMemoClick = useCallback(() => {
    onEdit?.();
  }, [onEdit]);

  const handleToggleMemoStatusClick = useCallback(async () => {
    const isArchiving = memo.state !== State.ARCHIVED;
    const state = memo.state === State.ARCHIVED ? State.NORMAL : State.ARCHIVED;
    const message = memo.state === State.ARCHIVED ? t("message.restored-successfully") : t("message.archived-successfully");

    try {
      await updateMemo({
        update: {
          name: memo.name,
          state,
        },
        updateMask: ["state"],
      });
      toast.success(message);
    } catch (error: unknown) {
      handleError(error, toast.error, {
        context: `${isArchiving ? "Archive" : "Restore"} memo`,
        fallbackMessage: "An error occurred",
      });
      return;
    }

    if (isInMemoDetailPage) {
      navigateTo(memo.state === State.ARCHIVED ? "/" : "/archived");
    }
    memoUpdatedCallback();
  }, [memo.name, memo.state, t, isInMemoDetailPage, navigateTo, memoUpdatedCallback, updateMemo]);

  const handleCopyLink = useCallback(() => {
    let host = profile.instanceUrl;
    if (host === "") {
      host = window.location.origin;
    }
    copy(`${host}/${memo.name}`);
    toast.success(t("message.succeed-copy-link"));
  }, [memo.name, t, profile.instanceUrl]);

  const handleCopyContent = useCallback(() => {
    copy(memo.content);
    toast.success(t("message.succeed-copy-content"));
  }, [memo.content, t]);

  const handleDeleteMemoClick = useCallback(() => {
    setDeleteDialogOpen(true);
  }, [setDeleteDialogOpen]);

  const confirmDeleteMemo = useCallback(async () => {
    await deleteMemo(memo.name);
    toast.success(t("message.deleted-successfully"));
    if (isInMemoDetailPage) {
      navigateTo("/");
    }
    memoUpdatedCallback();
  }, [memo.name, t, isInMemoDetailPage, navigateTo, memoUpdatedCallback, deleteMemo]);

  return {
    handleTogglePinMemoBtnClick,
    handleEditMemoClick,
    handleToggleMemoStatusClick,
    handleCopyLink,
    handleCopyContent,
    handleDeleteMemoClick,
    confirmDeleteMemo,
  };
};
