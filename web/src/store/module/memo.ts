import { omit } from "lodash-es";
import * as api from "../../helpers/api";
import { DEFAULT_MEMO_LIMIT } from "../../helpers/consts";
import { useUserStore } from "./";
import store, { useAppSelector } from "../";
import { createMemo, deleteMemo, patchMemo, setIsFetching, upsertMemos } from "../reducer/memo";

const convertResponseModelMemo = (memo: Memo): Memo => {
  return {
    ...memo,
    createdTs: memo.createdTs * 1000,
    updatedTs: memo.updatedTs * 1000,
  };
};

export const useMemoStore = () => {
  const state = useAppSelector((state) => state.memo);
  const userStore = useUserStore();

  const fetchMemoById = async (memoId: MemoId) => {
    const { data } = (await api.getMemoById(memoId)).data;
    const memo = convertResponseModelMemo(data);

    return memo;
  };

  return {
    state,
    getState: () => {
      return store.getState().memo;
    },
    fetchMemos: async (limit = DEFAULT_MEMO_LIMIT, offset = 0) => {
      store.dispatch(setIsFetching(true));
      const memoFind: MemoFind = {
        rowStatus: "NORMAL",
        limit,
        offset,
      };
      if (userStore.isVisitorMode()) {
        memoFind.creatorId = userStore.getUserIdFromPath();
      }
      const { data } = (await api.getMemoList(memoFind)).data;
      const fetchedMemos = data.map((m) => convertResponseModelMemo(m));
      store.dispatch(upsertMemos(fetchedMemos));
      store.dispatch(setIsFetching(false));

      return fetchedMemos;
    },
    fetchAllMemos: async (limit = DEFAULT_MEMO_LIMIT, offset?: number) => {
      const memoFind: MemoFind = {
        rowStatus: "NORMAL",
        limit,
        offset,
      };

      const { data } = (await api.getAllMemos(memoFind)).data;
      const memos = data.map((m) => convertResponseModelMemo(m));
      return memos;
    },
    fetchArchivedMemos: async () => {
      const memoFind: MemoFind = {
        rowStatus: "ARCHIVED",
      };
      if (userStore.isVisitorMode()) {
        memoFind.creatorId = userStore.getUserIdFromPath();
      }
      const { data } = (await api.getMemoList(memoFind)).data;
      const archivedMemos = data.map((m) => {
        return convertResponseModelMemo(m);
      });
      return archivedMemos;
    },
    fetchMemoById,
    getMemoById: async (memoId: MemoId) => {
      for (const m of state.memos) {
        if (m.id === memoId) {
          return m;
        }
      }

      return await fetchMemoById(memoId);
    },
    getLinkedMemos: async (memoId: MemoId): Promise<Memo[]> => {
      const regex = new RegExp(`[@(.+?)](${memoId})`);
      return state.memos.filter((m) => m.content.match(regex));
    },
    createMemo: async (memoCreate: MemoCreate) => {
      const { data } = (await api.createMemo(memoCreate)).data;
      const memo = convertResponseModelMemo(data);
      store.dispatch(createMemo(memo));
      return memo;
    },
    patchMemo: async (memoPatch: MemoPatch): Promise<Memo> => {
      const { data } = (await api.patchMemo(memoPatch)).data;
      const memo = convertResponseModelMemo(data);
      store.dispatch(patchMemo(omit(memo, "pinned")));
      return memo;
    },
    pinMemo: async (memoId: MemoId) => {
      await api.pinMemo(memoId);
      store.dispatch(
        patchMemo({
          id: memoId,
          pinned: true,
        })
      );
    },
    unpinMemo: async (memoId: MemoId) => {
      await api.unpinMemo(memoId);
      store.dispatch(
        patchMemo({
          id: memoId,
          pinned: false,
        })
      );
    },
    deleteMemoById: async (memoId: MemoId) => {
      await api.deleteMemo(memoId);
      store.dispatch(deleteMemo(memoId));
    },
  };
};
