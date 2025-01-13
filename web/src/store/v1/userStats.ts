import { uniqueId } from "lodash-es";
import { create } from "zustand";
import { combine } from "zustand/middleware";
import { userServiceClient } from "@/grpcweb";
import { UserStats } from "@/types/proto/api/v1/user_service";

interface State {
  // stateId is used to identify the store instance state.
  // It should be update when any state change.
  stateId: string;
  userStatsByName: Record<string, UserStats>;
}

const getDefaultState = (): State => ({
  stateId: uniqueId(),
  userStatsByName: {},
});

export const useUserStatsStore = create(
  combine(getDefaultState(), (set, get) => ({
    setState: (state: State) => set(state),
    getState: () => get(),
    listUserStats: async (user?: string, filter?: string) => {
      const userStatsByName: Record<string, UserStats> = {};
      if (!user) {
        const { userStats } = await userServiceClient.listAllUserStats({ filter });
        for (const stats of userStats) {
          userStatsByName[stats.name] = stats;
        }
      } else {
        const userStats = await userServiceClient.getUserStats({ name: user, filter });
        userStatsByName[user] = userStats;
      }
      set({ stateId: uniqueId(), userStatsByName });
    },
  })),
);

export const useUserStatsTags = () => {
  const userStatsStore = useUserStatsStore();
  const tagAmounts: Record<string, number> = {};
  for (const userStats of Object.values(userStatsStore.getState().userStatsByName)) {
    for (const tag of Object.keys(userStats.tagCount)) {
      tagAmounts[tag] = (tagAmounts[tag] || 0) + userStats.tagCount[tag];
    }
  }
  return tagAmounts;
};
