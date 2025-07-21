import { uniqueId } from "lodash-es";
import { makeAutoObservable } from "mobx";
import { memoServiceClient } from "@/grpcweb";
import { CreateMemoRequest, ListMemosRequest, Memo } from "@/types/proto/api/v1/memo_service";

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

  const fetchMemos = async (request: Partial<ListMemosRequest>) => {
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
      if (error.name === "AbortError") {
        return;
      }
      throw error;
    } finally {
      if (state.currentRequest === controller) {
        state.setPartial({ currentRequest: null });
      }
    }
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
    const memo = await memoServiceClient.updateMemo({
      memo: update,
      updateMask,
    });

    const memoMap = { ...state.memoMapByName };
    memoMap[memo.name] = memo;
    state.setPartial({
      stateId: uniqueId(),
      memoMapByName: memoMap,
    });
    return memo;
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
