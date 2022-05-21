import api from "../helpers/api";
import { TAG_REG } from "../helpers/consts";
import utils from "../helpers/utils";
import { patchMemo, setMemos, setTags } from "../store/modules/memo";
import store from "../store";
import userService from "./userService";

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
    if (!userService.getState().user) {
      return false;
    }

    const data = await api.getMyMemos();
    const memos: Memo[] = data.filter((m) => m.rowStatus !== "ARCHIVED").map((m) => convertResponseModelMemo(m));
    store.dispatch(setMemos(memos));

    return memos;
  },

  fetchDeletedMemos: async () => {
    if (!userService.getState().user) {
      return false;
    }

    const data = await api.getMyArchivedMemos();
    const deletedMemos: Memo[] = data.map((m) => {
      return convertResponseModelMemo(m);
    });
    return deletedMemos;
  },

  pushMemo: (memo: Memo) => {
    store.dispatch(setMemos(memoService.getState().memos.concat(memo)));
  },

  getMemoById: (id: MemoId) => {
    for (const m of memoService.getState().memos) {
      if (m.id === id) {
        return m;
      }
    }

    return null;
  },

  archiveMemoById: async (id: MemoId) => {
    const memo = memoService.getMemoById(id);
    if (!memo) {
      return;
    }

    await api.archiveMemo(id);
    store.dispatch(
      patchMemo({
        ...memo,
        rowStatus: "ARCHIVED",
      })
    );
  },

  restoreMemoById: async (id: MemoId) => {
    await api.restoreMemo(id);
    memoService.clearMemos();
    memoService.fetchAllMemos();
  },

  deleteMemoById: async (id: MemoId) => {
    await api.deleteMemo(id);
  },

  editMemo: (memo: Memo) => {
    store.dispatch(patchMemo(memo));
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

  clearMemos: () => {
    store.dispatch(setMemos([]));
  },

  getLinkedMemos: async (memoId: MemoId): Promise<Memo[]> => {
    const { memos } = memoService.getState();
    return memos.filter((m) => m.content.includes(`${memoId}`));
  },

  createMemo: async (content: string): Promise<Memo> => {
    const memo = await api.createMemo({
      content,
    });
    return convertResponseModelMemo(memo);
  },

  updateMemo: async (memoId: MemoId, content: string): Promise<Memo> => {
    const memo = await api.patchMemo({
      id: memoId,
      content,
    });
    return convertResponseModelMemo(memo);
  },

  pinMemo: async (memoId: MemoId) => {
    await api.pinMemo(memoId);
  },

  unpinMemo: async (memoId: MemoId) => {
    await api.unpinMemo(memoId);
  },

  importMemo: async (content: string, createdAt: string) => {
    const createdTs = Math.floor(utils.getTimeStampByDate(createdAt) / 1000);

    await api.createMemo({
      content,
      createdTs,
    });
  },
};

export default memoService;
