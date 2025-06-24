import { uniqueId } from "lodash-es";
import { create } from "zustand";
import { combine } from "zustand/middleware";
import { memoServiceClient } from "@/grpcweb";
import { CreateMemoRequest, ListMemosRequest, Memo, MemoView } from "@/types/proto/api/v1/memo_service";

interface State {
  // stateId is used to identify the store instance state.
  // It should be update when any state change.
  stateId: string;
  memoMapByName: Record<string, Memo>;
  pinnedMemoMapByName: Record<string, Memo>;
  currentRequest: AbortController | null;
}

const getDefaultState = (): State => ({
  stateId: uniqueId(),
  memoMapByName: {},
  pinnedMemoMapByName: {},
  currentRequest: null,
});

export const useMemoStore = create(
  combine(getDefaultState(), (set, get) => ({
    setState: (state: State) => set(state),
    getState: () => get(),
    updateStateId: () => set({ stateId: uniqueId() }),
    fetchMemos: async (request: Partial<ListMemosRequest>) => {
      const currentRequest = get().currentRequest;
      if (currentRequest) {
        currentRequest.abort();
      }

      const controller = new AbortController();
      set({ currentRequest: controller });

      try {
        const { memos, nextPageToken } = await memoServiceClient.listMemos(
          {
            ...request,
            view: MemoView.MEMO_VIEW_FULL,
          },
          { signal: controller.signal },
        );

        if (!controller.signal.aborted) {
          const memoMap = request.pageToken ? { ...get().memoMapByName } : {};
          for (const memo of memos) {
            memoMap[memo.name] = memo;
          }
          set({ stateId: uniqueId(), memoMapByName: memoMap });
          return { memos, nextPageToken };
        }
      } catch (error: any) {
        if (error.name === "AbortError") {
          return;
        }
        throw error;
      } finally {
        if (get().currentRequest === controller) {
          set({ currentRequest: null });
        }
      }
    },
    getOrFetchMemoByName: async (name: string, options?: { skipCache?: boolean; skipStore?: boolean }) => {
      const memoMap = get().memoMapByName;
      const memoCache = memoMap[name];
      if (memoCache && !options?.skipCache) {
        return memoCache;
      }

      const memo = await memoServiceClient.getMemo({
        name,
      });
      if (!options?.skipStore) {
        memoMap[name] = memo;
        set({ stateId: uniqueId(), memoMapByName: memoMap });
      }
      return memo;
    },
    getMemoByName: (name: string) => {
      return get().memoMapByName[name];
    },
    fetchMemoByUid: async (uid: string) => {
      const memo = await memoServiceClient.getMemoByUid({
        uid,
      });
      const memoMap = get().memoMapByName;
      memoMap[memo.name] = memo;
      set({ stateId: uniqueId(), memoMapByName: memoMap });
      return memo;
    },
    getMemoByUid: (uid: string) => {
      const memoMap = get().memoMapByName;
      return Object.values(memoMap).find((memo) => memo.uid === uid);
    },
    createMemo: async (request: CreateMemoRequest) => {
      const memo = await memoServiceClient.createMemo(request);
      const memoMap = get().memoMapByName;
      memoMap[memo.name] = memo;
      set({ stateId: uniqueId(), memoMapByName: memoMap });
      return memo;
    },
    updateMemo: async (update: Partial<Memo>, updateMask: string[]) => {
      const memo = await memoServiceClient.updateMemo({
        memo: update,
        updateMask,
      });

      const memoMap = get().memoMapByName;
      const pinnedMemoMap = get().pinnedMemoMapByName;

      memoMap[memo.name] = memo;

      // Update pinnedMemoMapByName based on the memo's pinned status
      if (memo.pinned) {
        // Add the memo to the front of pinnedMemoMap
        const newPinnedMemoMap = { [memo.name]: memo, ...pinnedMemoMap };
        set({ stateId: uniqueId(), memoMapByName: memoMap, pinnedMemoMapByName: newPinnedMemoMap });
      } else {
        delete pinnedMemoMap[memo.name];
        set({ stateId: uniqueId(), memoMapByName: memoMap, pinnedMemoMapByName: pinnedMemoMap });
      }
      return memo;
    },
    deleteMemo: async (name: string) => {
      await memoServiceClient.deleteMemo({
        name,
      });

      const memoMap = get().memoMapByName;
      delete memoMap[name];
      set({ stateId: uniqueId(), memoMapByName: memoMap });
    },
    fetchPinnedMemos: async (creatorName: string) => {
      const { memos, nextPageToken } = await memoServiceClient.listMemos({
        filter: `creator == "${creatorName}" && row_status == "NORMAL" && order_by_pinned == true && pinned == true`,
        pageSize: 1000,
        view: MemoView.MEMO_VIEW_FULL,
      });

      const memoMap = get().pinnedMemoMapByName;
      for (const memo of memos) {
        memoMap[memo.name] = memo;
      }
      set({ pinnedMemoMapByName: memoMap });
      return { memos, nextPageToken };
    },
  })),
);

export const useMemoList = () => {
  const memoStore = useMemoStore();
  const memos = Object.values(memoStore.getState().memoMapByName);

  const reset = () => {
    memoStore.updateStateId();
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

export const usePinnedMemoList = () => {
  const memoStore = useMemoStore();
  const memos = Object.values(memoStore.getState().pinnedMemoMapByName);
  return memos;
};
