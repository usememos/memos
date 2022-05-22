import * as api from "../helpers/api";
import { TAG_REG } from "../helpers/consts";
import { createMemo, patchMemo, setMemos, setTags } from "../store/modules/memo";
import store from "../store";

const convertResponseModelMemo = (memo: Memo): Memo => {
  return {
    ...memo,
    createdTs: memo.createdTs * 1000,
    updatedTs: memo.updatedTs * 1000,
  };
};

const memoService = {
  getState: () => {
    return store.getState().memo;
  },

  fetchAllMemos: async () => {
    const { data } = (await api.getMyMemos()).data;
    const memos = data.filter((m) => m.rowStatus !== "ARCHIVED").map((m) => convertResponseModelMemo(m));
    store.dispatch(setMemos(memos));

    return memos;
  },

  fetchDeletedMemos: async () => {
    const { data } = (await api.getMyArchivedMemos()).data;
    const deletedMemos = data.map((m) => {
      return convertResponseModelMemo(m);
    });
    return deletedMemos;
  },

  getMemoById: (memoId: MemoId) => {
    for (const m of memoService.getState().memos) {
      if (m.id === memoId) {
        return m;
      }
    }

    return null;
  },

  updateTagsState: () => {
    const { memos } = memoService.getState();
    const tagsSet = new Set<string>();
    for (const m of memos) {
      for (const t of Array.from(m.content.match(TAG_REG) ?? [])) {
        tagsSet.add(t.replace(TAG_REG, "$1").trim());
      }
    }

    store.dispatch(setTags(Array.from(tagsSet).filter((t) => Boolean(t))));
  },

  getLinkedMemos: async (memoId: MemoId): Promise<Memo[]> => {
    const { memos } = memoService.getState();
    return memos.filter((m) => m.content.includes(`${memoId}`));
  },

  createMemo: async (memoCreate: MemoCreate) => {
    const { data } = (await api.createMemo(memoCreate)).data;
    const memo = convertResponseModelMemo(data);
    store.dispatch(createMemo(memo));
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
  },
};

export default memoService;
