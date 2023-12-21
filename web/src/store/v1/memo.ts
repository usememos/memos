import { create } from "zustand";
import { combine } from "zustand/middleware";
import { memoServiceClient } from "@/grpcweb";
import { CreateMemoRequest, ListMemosRequest, Memo } from "@/types/proto/api/v2/memo_service";

export const useMemoV1Store = create(
  combine({ memoById: new Map<number, Memo>() }, (set, get) => ({
    getState: () => get(),
    fetchMemos: async (request: Partial<ListMemosRequest>) => {
      const { memos } = await memoServiceClient.listMemos(request);
      return memos;
    },
    getOrFetchMemoById: async (id: number) => {
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
    createMemo: async (request: CreateMemoRequest) => {
      const { memo } = await memoServiceClient.createMemo(request);
      if (!memo) {
        throw new Error("Memo not found");
      }

      set((state) => {
        state.memoById.set(memo.id, memo);
        return state;
      });
      return memo;
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
    deleteMemo: async (id: number) => {
      await memoServiceClient.deleteMemo({
        id: id,
      });
      set((state) => {
        state.memoById.delete(id);
        return state;
      });
    },
    fetchMemoResources: async (id: number) => {
      const { resources } = await memoServiceClient.listMemoResources({
        id,
      });
      return resources;
    },
    fetchMemoRelations: async (id: number) => {
      const { relations } = await memoServiceClient.listMemoRelations({
        id,
      });
      return relations;
    },
  }))
);
