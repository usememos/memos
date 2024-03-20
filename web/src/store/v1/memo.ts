import { create } from "zustand";
import { combine } from "zustand/middleware";
import { memoServiceClient } from "@/grpcweb";
import { CreateMemoRequest, ListMemosRequest, Memo } from "@/types/proto/api/v2/memo_service";

interface State {
  memoMapByName: Record<string, Memo>;
}

const getDefaultState = (): State => ({
  memoMapByName: {},
});

export const useMemoStore = create(
  combine(getDefaultState(), (set, get) => ({
    setState: (state: State) => set(state),
    getState: () => get(),
    fetchMemos: async (request: Partial<ListMemosRequest>) => {
      const { memos, nextPageToken } = await memoServiceClient.listMemos(request);
      const memoMap = get().memoMapByName;
      for (const memo of memos) {
        memoMap[memo.name] = memo;
      }
      set({ memoMapByName: memoMap });
      return { memos, nextPageToken };
    },
    getOrFetchMemoByName: async (name: string, options?: { skipCache?: boolean; skipStore?: boolean }) => {
      const memoMap = get().memoMapByName;
      const memo = memoMap[name];
      if (memo && !options?.skipCache) {
        return memo;
      }

      const res = await memoServiceClient.getMemo({
        name,
      });
      if (!res.memo) {
        throw new Error("Memo not found");
      }

      if (!options?.skipStore) {
        memoMap[name] = res.memo;
        set({ memoMapByName: memoMap });
      }
      return res.memo;
    },
    getMemoByName: (name: string) => {
      return get().memoMapByName[name];
    },
    searchMemos: async (filter: string) => {
      const { memos } = await memoServiceClient.searchMemos({
        filter,
      });
      const memoMap = get().memoMapByName;
      for (const memo of memos) {
        memoMap[memo.name] = memo;
      }
      set({ memoMapByName: memoMap });
      return memos;
    },
    getMemoByUid: (uid: string) => {
      const memoMap = get().memoMapByName;
      return Object.values(memoMap).find((memo) => memo.uid === uid);
    },
    createMemo: async (request: CreateMemoRequest) => {
      const { memo } = await memoServiceClient.createMemo(request);
      if (!memo) {
        throw new Error("Memo not found");
      }

      const memoMap = get().memoMapByName;
      memoMap[memo.name] = memo;
      set({ memoMapByName: memoMap });
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

      const memoMap = get().memoMapByName;
      memoMap[memo.name] = memo;
      set({ memoMapByName: memoMap });
      return memo;
    },
    deleteMemo: async (name: string) => {
      await memoServiceClient.deleteMemo({
        name,
      });

      const memoMap = get().memoMapByName;
      delete memoMap[name];
      set({ memoMapByName: memoMap });
    },
  })),
);

export const useMemoList = () => {
  const memoStore = useMemoStore();
  const memos = Object.values(memoStore.getState().memoMapByName);

  const reset = () => {
    memoStore.setState({ memoMapByName: {} });
  };

  const size = () => {
    return Object.keys(memoStore.getState().memoMapByName).length;
  };

  return {
    value: memos,
    reset,
    size,
  };
};
