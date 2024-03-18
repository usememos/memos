import { create } from "zustand";
import { combine } from "zustand/middleware";
import { memoServiceClient } from "@/grpcweb";
import { CreateMemoRequest, ListMemosRequest, Memo } from "@/types/proto/api/v2/memo_service";
import { MemoNamePrefix, extractMemoIdFromName } from ".";

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
      const { memos, nextPageToken } = await memoServiceClient.listMemos(request);
      const memoMap = get().memoMapById;
      for (const memo of memos) {
        const id = extractMemoIdFromName(memo.name);
        memoMap[id] = memo;
      }
      set({ memoMapById: memoMap });
      return { memos, nextPageToken };
    },
    getOrFetchMemoById: async (id: number, options?: { skipCache?: boolean; skipStore?: boolean }) => {
      const memoMap = get().memoMapById;
      const memo = memoMap[id];
      if (memo && !options?.skipCache) {
        return memo;
      }

      const res = await memoServiceClient.getMemo({
        name: `${MemoNamePrefix}${id}`,
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
    searchMemos: async (filter: string) => {
      const { memos } = await memoServiceClient.searchMemos({
        filter,
      });
      const memoMap = get().memoMapById;
      for (const memo of memos) {
        const id = extractMemoIdFromName(memo.name);
        memoMap[id] = memo;
      }
      set({ memoMapById: memoMap });
      return memos;
    },
    getMemoByName: (name: string) => {
      const memoMap = get().memoMapById;
      return Object.values(memoMap).find((memo) => memo.resourceId === name);
    },
    createMemo: async (request: CreateMemoRequest) => {
      const { memo } = await memoServiceClient.createMemo(request);
      if (!memo) {
        throw new Error("Memo not found");
      }

      const memoMap = get().memoMapById;
      const id = extractMemoIdFromName(memo.name);
      memoMap[id] = memo;
      set({ memoMapById: memoMap });
      return memo;
    },
    updateMemo: async (update: Partial<Memo>, updateMask: string[]) => {
      const { memo } = await memoServiceClient.updateMemo({
        memo: update,
        updateMask,
      });
      if (!memo) {
        throw new Error("Memo not found");
      }

      const memoMap = get().memoMapById;
      const id = extractMemoIdFromName(memo.name);
      memoMap[id] = memo;
      set({ memoMapById: memoMap });
      return memo;
    },
    deleteMemo: async (id: number) => {
      await memoServiceClient.deleteMemo({
        name: `${MemoNamePrefix}${id}`,
      });

      const memoMap = get().memoMapById;
      delete memoMap[id];
      set({ memoMapById: memoMap });
    },
  })),
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
