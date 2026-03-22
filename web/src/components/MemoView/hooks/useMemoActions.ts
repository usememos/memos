import { useUpdateMemo } from "@/hooks/useMemoQueries";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

export const useMemoActions = (memo: Memo) => {
  const { mutateAsync: updateMemo } = useUpdateMemo();

  const unpinMemo = async () => {
    if (!memo.pinned) return;
    await updateMemo({ update: { name: memo.name, pinned: false }, updateMask: ["pinned"] });
  };

  return { unpinMemo };
};
