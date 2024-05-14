import { create } from "zustand";
import { combine } from "zustand/middleware";
import { memoServiceClient } from "@/grpcweb";

interface State {
  tagAmounts: Record<string, number>;
}

const getDefaultState = (): State => ({
  tagAmounts: {},
});

export const useTagStore = create(
  combine(getDefaultState(), (set, get) => ({
    setState: (state: State) => set(state),
    getState: () => get(),
    sortedTags: () => {
      return Object.entries(get().tagAmounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .sort((a, b) => b[1] - a[1])
        .map(([tag]) => tag);
    },
    fetchTags: async (filter?: string, options?: { skipCache: boolean }) => {
      const { tagAmounts: cache } = get();
      if (cache.length > 0 && !options?.skipCache) {
        return cache;
      }
      const { tagAmounts } = await memoServiceClient.listMemoTags({ parent: "memos/-", filter });
      set({ tagAmounts });
    },
  })),
);
