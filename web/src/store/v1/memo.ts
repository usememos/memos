import { create } from "zustand";
import { combine } from "zustand/middleware";
import { memoServiceClient } from "@/grpcweb";
import { Memo } from "@/types/proto/api/v2/memo_service";

export const useMemoV1Store = create(
  combine({ memoById: new Map<number, Memo>() }, (set, get) => ({
    getState: () => get(),
    getOrFetchMemoById: async (id: MemoId) => {
      const memo = get().memoById.get(id);
      if (memo) {
        return memo;
      }

      const res = await memoServiceClient.getMemo({
        id,
      });
      if (!res.memo) {
        throw new Error("Memo not found");
      }

      set((state) => {
        state.memoById.set(id, res.memo as Memo);
        return state;
      });

      return res.memo;
    },
    getMemoById: (id: number) => {
      return get().memoById.get(id);
    },
    updateMemo: async (update: Partial<Memo>, updateMask: string[]) => {
      const { memo } = await memoServiceClient.updateMemo({
        id: update.id!,
        memo: update,
        updateMask,
      });
      if (!memo) {
        throw new Error("Memo not found");
      }

      set((state) => {
        state.memoById.set(memo.id, memo);
        return state;
      });

      return memo;
    },
    deleteMemo: async (memo: Memo) => {
      await memoServiceClient.deleteMemo({
        id: memo.id,
      });
      set((state) => {
        state.memoById.delete(memo.id);
        return state;
      });
    },
  }))
);
