import dayjs from "dayjs";
import { countBy } from "lodash-es";
import { useMemo } from "react";
import { userStore } from "@/store";
import { UserStats_MemoTypeStats } from "@/types/proto/api/v1/user_service";
import type { StatisticsData } from "@/types/statistics";

export const useStatisticsData = (): StatisticsData => {
  return useMemo(() => {
    const memoTypeStats = UserStats_MemoTypeStats.fromPartial({});
    const displayTimeList: Date[] = [];

    for (const stats of Object.values(userStore.state.userStatsByName)) {
      displayTimeList.push(...stats.memoDisplayTimestamps);
      if (stats.memoTypeStats) {
        memoTypeStats.codeCount += stats.memoTypeStats.codeCount;
        memoTypeStats.linkCount += stats.memoTypeStats.linkCount;
        memoTypeStats.todoCount += stats.memoTypeStats.todoCount;
        memoTypeStats.undoCount += stats.memoTypeStats.undoCount;
      }
    }

    const activityStats = countBy(displayTimeList.map((date) => dayjs(date).format("YYYY-MM-DD")));

    return { memoTypeStats, activityStats };
  }, [userStore.state.userStatsByName]);
};
