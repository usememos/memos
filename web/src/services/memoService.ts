import { uniqBy } from "lodash";
import * as api from "../helpers/api";
import { createMemo, deleteMemo, patchMemo, setIsFetching, setMemos, setTags } from "../store/modules/memo";
import store from "../store";
import userService from "./userService";

export const DEFAULT_MEMO_LIMIT = 20;

const convertResponseModelMemo = (memo: Memo): Memo => {
  return {
    ...memo,
    createdTs: memo.createdTs * 1000,
    updatedTs: memo.updatedTs * 1000,
    displayTs: memo.displayTs * 1000,
  };
};

const memoService = {
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
    if (userService.isVisitorMode()) {
      memoFind.creatorId = userService.getUserIdFromPath();
    }
    const { data } = (await api.getMemoList(memoFind)).data;
    const fetchedMemos = data.map((m) => convertResponseModelMemo(m));
    if (offset === 0) {
      store.dispatch(setMemos([]));
    }
    const memos = memoService.getState().memos;
    store.dispatch(setMemos(uniqBy(memos.concat(fetchedMemos), "id")));
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
    if (userService.isVisitorMode()) {
      memoFind.creatorId = userService.getUserIdFromPath();
    }
    const { data } = (await api.getMemoList(memoFind)).data;
    const archivedMemos = data.map((m) => {
      return convertResponseModelMemo(m);
    });
    return archivedMemos;
  },

  fetchMemoById: async (memoId: MemoId) => {
    const { data } = (await api.getMemoById(memoId)).data;
    const memo = convertResponseModelMemo(data);

    return memo;
  },

  getMemoById: async (memoId: MemoId) => {
    for (const m of memoService.getState().memos) {
      if (m.id === memoId) {
        return m;
      }
    }

    return await memoService.fetchMemoById(memoId);
  },

  updateTagsState: async () => {
    const tagFind: TagFind = {};
    if (userService.isVisitorMode()) {
      tagFind.creatorId = userService.getUserIdFromPath();
    }
    const { data } = (await api.getTagList(tagFind)).data;
    store.dispatch(setTags(data));
  },

  getLinkedMemos: async (memoId: MemoId): Promise<Memo[]> => {
    const { memos } = memoService.getState();
    const regex = new RegExp(`[@(.+?)](${memoId})`);
    return memos.filter((m) => m.content.match(regex));
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
    store.dispatch(patchMemo(memo));
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

export default memoService;
