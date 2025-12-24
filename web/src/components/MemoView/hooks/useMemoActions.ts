import toast from "react-hot-toast";
import { useUpdateMemo } from "@/hooks/useMemoQueries";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

export const useMemoActions = (memo: Memo) => {
  const t = useTranslate();
  const { mutateAsync: updateMemo } = useUpdateMemo();
  const isArchived = memo.state === State.ARCHIVED;

  const archiveMemo = async () => {
    if (isArchived) return;
    try {
      await updateMemo({ update: { name: memo.name, state: State.ARCHIVED }, updateMask: ["state"] });
      toast.success(t("message.archived-successfully"));
    } catch (error: unknown) {
      console.error(error);
      const err = error as { details?: string };
      toast.error(err?.details || "Failed to archive memo");
    }
  };

  const unpinMemo = async () => {
    if (!memo.pinned) return;
    await updateMemo({ update: { name: memo.name, pinned: false }, updateMask: ["pinned"] });
  };

  return { archiveMemo, unpinMemo };
};
