import { uniqueId } from "lodash-es";
import { makeAutoObservable } from "mobx";
import { memoServiceClient } from "@/grpcweb";
import { CreateMemoRequest, ListMemosRequest, Memo } from "@/types/proto/api/v1/memo_service";
import { RequestDeduplicator, createRequestKey, StoreError } from "./store-utils";

class LocalState {
  stateId: string = uniqueId();
  memoMapByName: Record<string, Memo> = {};
  currentRequest: AbortController | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  setPartial(partial: Partial<LocalState>) {
    Object.assign(this, partial);
  }

  updateStateId() {
    this.stateId = uniqueId();
  }

  get memos() {
    return Object.values(this.memoMapByName);
  }

  get size() {
    return Object.keys(this.memoMapByName).length;
  }
}

const memoStore = (() => {
  const state = new LocalState();
  const deduplicator = new RequestDeduplicator();

  const fetchMemos = async (request: Partial<ListMemosRequest>) => {
    // Deduplicate requests with the same parameters
    const requestKey = createRequestKey("fetchMemos", request as Record<string, any>);

    return deduplicator.execute(requestKey, async () => {
      if (state.currentRequest) {
        state.currentRequest.abort();
      }

      const controller = new AbortController();
      state.setPartial({ currentRequest: controller });

      try {
        const { memos, nextPageToken } = await memoServiceClient.listMemos(
          {
            ...request,
          },
          { signal: controller.signal },
        );

        if (!controller.signal.aborted) {
          const memoMap = request.pageToken ? { ...state.memoMapByName } : {};
          for (const memo of memos) {
            memoMap[memo.name] = memo;
          }
          state.setPartial({
            stateId: uniqueId(),
            memoMapByName: memoMap,
          });
          return { memos, nextPageToken };
        }
      } catch (error: any) {
        if (StoreError.isAbortError(error)) {
          return;
        }
        throw StoreError.wrap("FETCH_MEMOS_FAILED", error);
      } finally {
        if (state.currentRequest === controller) {
          state.setPartial({ currentRequest: null });
        }
      }
    });
  };

  const getOrFetchMemoByName = async (name: string, options?: { skipCache?: boolean; skipStore?: boolean }) => {
    const memoCache = state.memoMapByName[name];
    if (memoCache && !options?.skipCache) {
      return memoCache;
    }

    const memo = await memoServiceClient.getMemo({
      name,
    });

    if (!options?.skipStore) {
      const memoMap = { ...state.memoMapByName };
      memoMap[name] = memo;
      state.setPartial({
        stateId: uniqueId(),
        memoMapByName: memoMap,
      });
    }

    return memo;
  };

  const getMemoByName = (name: string) => {
    return state.memoMapByName[name];
  };

  const createMemo = async (request: CreateMemoRequest) => {
    const memo = await memoServiceClient.createMemo(request);
    const memoMap = { ...state.memoMapByName };
    memoMap[memo.name] = memo;
    state.setPartial({
      stateId: uniqueId(),
      memoMapByName: memoMap,
    });
    return memo;
  };

  const updateMemo = async (update: Partial<Memo>, updateMask: string[]) => {
    // Optimistic update: immediately update the UI
    const previousMemo = state.memoMapByName[update.name!];
    const optimisticMemo = { ...previousMemo, ...update };

    // Apply optimistic update
    const memoMap = { ...state.memoMapByName };
    memoMap[update.name!] = optimisticMemo;
    state.setPartial({
      stateId: uniqueId(),
      memoMapByName: memoMap,
    });

    try {
      // Perform actual server update
      const memo = await memoServiceClient.updateMemo({
        memo: update,
        updateMask,
      });

      // Confirm with server response
      const confirmedMemoMap = { ...state.memoMapByName };
      confirmedMemoMap[memo.name] = memo;
      state.setPartial({
        stateId: uniqueId(),
        memoMapByName: confirmedMemoMap,
      });
      return memo;
    } catch (error) {
      // Rollback on error
      const rollbackMemoMap = { ...state.memoMapByName };
      rollbackMemoMap[update.name!] = previousMemo;
      state.setPartial({
        stateId: uniqueId(),
        memoMapByName: rollbackMemoMap,
      });
      throw StoreError.wrap("UPDATE_MEMO_FAILED", error);
    }
  };

  const deleteMemo = async (name: string) => {
    await memoServiceClient.deleteMemo({
      name,
    });

    const memoMap = { ...state.memoMapByName };
    delete memoMap[name];
    state.setPartial({
      stateId: uniqueId(),
      memoMapByName: memoMap,
    });
  };

  return {
    state,
    fetchMemos,
    getOrFetchMemoByName,
    getMemoByName,
    createMemo,
    updateMemo,
    deleteMemo,
  };
})();

export default memoStore;
