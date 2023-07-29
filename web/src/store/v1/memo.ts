import { create } from "zustand";
import { combine } from "zustand/middleware";
import * as api from "@/helpers/api";
import { convertResponseModelMemo } from "../module";

const useMemoCacheStore = create(
  combine({ memoById: new Map<MemoId, Memo>() }, (set, get) => ({
    getState: () => get(),
    getOrFetchMemoById: async (memoId: MemoId) => {
      const memo = get().memoById.get(memoId);
      if (memo) {
        return memo;
      }

      const { data } = await api.getMemoById(memoId);
      const formatedMemo = convertResponseModelMemo(data);

      set((state) => {
        state.memoById.set(memoId, formatedMemo);
        return state;
      });

      return formatedMemo;
    },
    getMemoById: (memoId: MemoId) => {
      return get().memoById.get(memoId);
    },
    setMemoCache: (memo: Memo) => {
      set((state) => {
        state.memoById.set(memo.id, memo);
        return state;
      });
    },
    deleteMemoCache: (memoId: MemoId) => {
      set((state) => {
        state.memoById.delete(memoId);
        return state;
      });
    },
  }))
);

export default useMemoCacheStore;
