import { Location } from "react-router-dom";
import { create } from "zustand";
import { combine } from "zustand/middleware";
import { memoServiceClient } from "@/grpcweb";
import { Routes } from "@/router";
import { MemoView } from "@/types/proto/api/v1/memo_service";
import { User } from "@/types/proto/api/v1/user_service";

// Set the maximum number of memos to fetch.
const DEFAULT_MEMO_PAGE_SIZE = 1000000;

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
    fetchTags: async (params: { user?: User; location?: Location<any> }, options?: { skipCache?: boolean }) => {
      const { tagAmounts: cache } = get();
      if (cache.length > 0 && !options?.skipCache) {
        return cache;
      }
      const filters = [`row_status == "NORMAL"`];
      if (params.user) {
        if (params.location?.pathname === Routes.EXPLORE) {
          filters.push(`visibilities == ["PUBLIC", "PROTECTED"]`);
        }
        filters.push(`creator == "${params.user.name}"`);
      } else {
        filters.push(`visibilities == ["PUBLIC"]`);
      }
      const { memos } = await memoServiceClient.listMemos({
        pageSize: DEFAULT_MEMO_PAGE_SIZE,
        filter: filters.join(" && "),
        view: MemoView.MEMO_VIEW_METADATA_ONLY,
      });
      const tagAmounts: Record<string, number> = {};
      memos.forEach((memo) => {
        memo.property?.tags.forEach((tag) => {
          if (tagAmounts[tag]) {
            tagAmounts[tag] += 1;
          } else {
            tagAmounts[tag] = 1;
          }
        });
      });
      set({ tagAmounts });
    },
  })),
);
