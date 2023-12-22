import { cloneDeep } from "lodash-es";
import { create } from "zustand";
import { combine } from "zustand/middleware";
import { memoServiceClient } from "@/grpcweb";
import { CreateMemoRequest, ListMemosRequest, Memo } from "@/types/proto/api/v2/memo_service";

interface State {
  memoById: Map<number, Memo>;
}

export const useMemoV1Store = create(
  combine({ memoById: new Map<number, Memo>() }, (set, get) => ({
    setState: (state: State) => set(state),
    getState: () => get(),
    fetchMemos: async (request: Partial<ListMemosRequest>) => {
      const { memos } = await memoServiceClient.listMemos(request);
      set((state) => {
        for (const memo of memos) {
          state.memoById.set(memo.id, memo);
        }
        return cloneDeep(state);
      });
      return memos;
    },
    getOrFetchMemoById: async (id: number, options?: { skipCache?: boolean; skipStore?: boolean }) => {
      const memo = get().memoById.get(id);
      if (memo && !options?.skipCache) {
        return memo;
      }

      const res = await memoServiceClient.getMemo({
        id,
      });
      if (!res.memo) {
        throw new Error("Memo not found");
      }

      if (!options?.skipStore) {
        set((state) => {
          state.memoById.set(id, res.memo as Memo);
          return cloneDeep(state);
        });
      }
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
        return cloneDeep(state);
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
        return cloneDeep(state);
      });
      return memo;
    },
    deleteMemo: async (id: number) => {
      await memoServiceClient.deleteMemo({
        id: id,
      });

      set((state) => {
        state.memoById.delete(id);
        return cloneDeep(state);
      });
    },
  }))
);

export const useMemoList = () => {
  const memoStore = useMemoV1Store();
  const memos = Array.from(memoStore.getState().memoById.values());

  const reset = () => {
    memoStore.setState({ memoById: new Map<number, Memo>() });
  };

  const size = () => {
    return memoStore.getState().memoById.size;
  };

  return {
    value: memos,
    reset,
    size,
  };
};
