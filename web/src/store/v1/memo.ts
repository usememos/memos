import { create } from "zustand";
import { combine } from "zustand/middleware";
import { memoServiceClient } from "@/grpcweb";
import { CreateMemoRequest, ListMemosRequest, Memo } from "@/types/proto/api/v2/memo_service";

interface State {
  memoMapById: Record<number, Memo>;
}

const getDefaultState = (): State => ({
  memoMapById: {},
});

export const useMemoStore = create(
  combine(getDefaultState(), (set, get) => ({
    setState: (state: State) => set(state),
    getState: () => get(),
    fetchMemos: async (request: Partial<ListMemosRequest>) => {
      const { memos } = await memoServiceClient.listMemos(request);
      const memoMap = get().memoMapById;
      for (const memo of memos) {
        memoMap[memo.id] = memo;
      }
      set({ memoMapById: memoMap });
      return memos;
    },
    getOrFetchMemoById: async (id: number, options?: { skipCache?: boolean; skipStore?: boolean }) => {
      const memoMap = get().memoMapById;
      const memo = memoMap[id];
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
        memoMap[id] = res.memo;
        set({ memoMapById: memoMap });
      }
      return res.memo;
    },
    getMemoById: (id: number) => {
      return get().memoMapById[id];
    },
    createMemo: async (request: CreateMemoRequest) => {
      const { memo } = await memoServiceClient.createMemo(request);
      if (!memo) {
        throw new Error("Memo not found");
      }

      const memoMap = get().memoMapById;
      memoMap[memo.id] = memo;
      set({ memoMapById: memoMap });
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

      const memoMap = get().memoMapById;
      memoMap[memo.id] = memo;
      set({ memoMapById: memoMap });
      return memo;
    },
    deleteMemo: async (id: number) => {
      await memoServiceClient.deleteMemo({
        id: id,
      });

      const memoMap = get().memoMapById;
      delete memoMap[id];
      set({ memoMapById: memoMap });
    },
  }))
);

export const useMemoList = () => {
  const memoStore = useMemoStore();
  const memos = Object.values(memoStore.getState().memoMapById);

  const reset = () => {
    memoStore.setState({ memoMapById: {} });
  };

  const size = () => {
    return Object.keys(memoStore.getState().memoMapById).length;
  };

  return {
    value: memos,
    reset,
    size,
  };
};
