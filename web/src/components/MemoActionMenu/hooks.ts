import copy from "copy-to-clipboard";
import { useCallback } from "react";
import toast from "react-hot-toast";
import { useLocation } from "react-router-dom";
import useNavigateTo from "@/hooks/useNavigateTo";
import { instanceStore, memoStore, userStore } from "@/store";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { removeCompletedTasks } from "@/utils/markdown-manipulation";

interface UseMemoActionHandlersOptions {
  memo: Memo;
  onEdit?: () => void;
  setDeleteDialogOpen: (open: boolean) => void;
  setRemoveTasksDialogOpen: (open: boolean) => void;
}

export const useMemoActionHandlers = ({ memo, onEdit, setDeleteDialogOpen, setRemoveTasksDialogOpen }: UseMemoActionHandlersOptions) => {
  const t = useTranslate();
  const location = useLocation();
  const navigateTo = useNavigateTo();
  const isInMemoDetailPage = location.pathname.startsWith(`/${memo.name}`);

  const memoUpdatedCallback = useCallback(() => {
    userStore.setStatsStateId();
  }, []);

  const handleTogglePinMemoBtnClick = useCallback(async () => {
    try {
      await memoStore.updateMemo(
        {
          name: memo.name,
          pinned: !memo.pinned,
        },
        ["pinned"],
      );
    } catch {
      // do nothing
    }
  }, [memo.name, memo.pinned]);

  const handleEditMemoClick = useCallback(() => {
    onEdit?.();
  }, [onEdit]);

  const handleToggleMemoStatusClick = useCallback(async () => {
    const state = memo.state === State.ARCHIVED ? State.NORMAL : State.ARCHIVED;
    const message = memo.state === State.ARCHIVED ? t("message.restored-successfully") : t("message.archived-successfully");

    try {
      await memoStore.updateMemo(
        {
          name: memo.name,
          state,
        },
        ["state"],
      );
      toast.success(message);
    } catch (error: unknown) {
      const err = error as { details?: string };
      toast.error(err.details || "An error occurred");
      console.error(error);
      return;
    }

    if (isInMemoDetailPage) {
      navigateTo(memo.state === State.ARCHIVED ? "/" : "/archived");
    }
    memoUpdatedCallback();
  }, [memo.name, memo.state, t, isInMemoDetailPage, navigateTo, memoUpdatedCallback]);

  const handleCopyLink = useCallback(() => {
    let host = instanceStore.state.profile.instanceUrl;
    if (host === "") {
      host = window.location.origin;
    }
    copy(`${host}/${memo.name}`);
    toast.success(t("message.succeed-copy-link"));
  }, [memo.name, t]);

  const handleCopyContent = useCallback(() => {
    copy(memo.content);
    toast.success(t("message.succeed-copy-content"));
  }, [memo.content, t]);

  const handleDeleteMemoClick = useCallback(() => {
    setDeleteDialogOpen(true);
  }, [setDeleteDialogOpen]);

  const confirmDeleteMemo = useCallback(async () => {
    await memoStore.deleteMemo(memo.name);
    toast.success(t("message.deleted-successfully"));
    if (isInMemoDetailPage) {
      navigateTo("/");
    }
    memoUpdatedCallback();
  }, [memo.name, t, isInMemoDetailPage, navigateTo, memoUpdatedCallback]);

  const handleRemoveCompletedTaskListItemsClick = useCallback(() => {
    setRemoveTasksDialogOpen(true);
  }, [setRemoveTasksDialogOpen]);

  const confirmRemoveCompletedTaskListItems = useCallback(async () => {
    const newContent = removeCompletedTasks(memo.content);
    await memoStore.updateMemo(
      {
        name: memo.name,
        content: newContent,
      },
      ["content"],
    );
    toast.success(t("message.remove-completed-task-list-items-successfully"));
    memoUpdatedCallback();
  }, [memo.name, memo.content, t, memoUpdatedCallback]);

  return {
    handleTogglePinMemoBtnClick,
    handleEditMemoClick,
    handleToggleMemoStatusClick,
    handleCopyLink,
    handleCopyContent,
    handleDeleteMemoClick,
    confirmDeleteMemo,
    handleRemoveCompletedTaskListItemsClick,
    confirmRemoveCompletedTaskListItems,
  };
};
