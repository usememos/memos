import { Location } from "react-router-dom";
import { create } from "zustand";
import { combine } from "zustand/middleware";
import { memoServiceClient } from "@/grpcweb";
import { Routes } from "@/router";
import { User } from "@/types/proto/api/v1/user_service";

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
      const { tagAmounts } = await memoServiceClient.listMemoTags({ parent: "memos/-", filter: filters.join(" && ") });
      set({ tagAmounts });
    },
  })),
);
