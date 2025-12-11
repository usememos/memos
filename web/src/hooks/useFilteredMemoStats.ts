import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import { countBy } from "lodash-es";
import { useEffect, useState } from "react";
import { memoStore, userStore } from "@/store";
import type { StatisticsData } from "@/types/statistics";

export interface FilteredMemoStats {
  statistics: StatisticsData;
  tags: Record<string, number>;
  loading: boolean;
}

const getUserStatsKey = (userName: string): string => {
  return `${userName}/stats`;
};

export interface UseFilteredMemoStatsOptions {
  userName?: string;
}

export const useFilteredMemoStats = (options: UseFilteredMemoStatsOptions = {}): FilteredMemoStats => {
  const { userName } = options;
  const [data, setData] = useState<FilteredMemoStats>({
    statistics: {
      activityStats: {},
    },
    tags: {},
    loading: false,
  });
  // React to memo store changes (create, update, delete)
  const memoStoreStateId = memoStore.state.stateId;
  // React to user stats changes (for tag counts)
  const userStatsStateId = userStore.state.statsStateId;

  useEffect(() => {
    const computeStats = async () => {
      let activityStats: Record<string, number> = {};
      let tagCount: Record<string, number> = {};
      let useBackendStats = false;

      // Try to use backend user stats if userName is provided
      if (userName) {
        // Check if stats are already cached, otherwise fetch them
        const statsKey = getUserStatsKey(userName);
        let userStats = userStore.state.userStatsByName[statsKey];

        if (!userStats) {
          try {
            await userStore.fetchUserStats(userName);
            userStats = userStore.state.userStatsByName[statsKey];
          } catch (error) {
            console.error("Failed to fetch user stats:", error);
            // Will fall back to computing from cache below
          }
        }

        if (userStats) {
          // Use activity timestamps from user stats
          if (userStats.memoDisplayTimestamps && userStats.memoDisplayTimestamps.length > 0) {
            activityStats = countBy(
              userStats.memoDisplayTimestamps
                .map((ts) => (ts ? timestampDate(ts) : undefined))
                .filter((date): date is Date => date !== undefined)
                .map((date) => dayjs(date).format("YYYY-MM-DD")),
            );
          }
          // Use tag counts from user stats
          if (userStats.tagCount) {
            tagCount = userStats.tagCount;
          }
          useBackendStats = true;
        }
      }

      // Fallback: compute from cached memos if backend stats not available
      // Also used for Explore and Archived contexts
      if (!useBackendStats) {
        const displayTimeList: Date[] = [];
        const memos = memoStore.state.memos;

        for (const memo of memos) {
          // Collect display timestamps for activity calendar
          const displayTime = memo.displayTime ? timestampDate(memo.displayTime) : undefined;
          if (displayTime) {
            displayTimeList.push(displayTime);
          }
          // Count tags
          if (memo.tags && memo.tags.length > 0) {
            for (const tag of memo.tags) {
              tagCount[tag] = (tagCount[tag] || 0) + 1;
            }
          }
        }

        activityStats = countBy(displayTimeList.map((date) => dayjs(date).format("YYYY-MM-DD")));
      }

      setData({
        statistics: { activityStats },
        tags: tagCount,
        loading: false,
      });
    };

    computeStats();
  }, [memoStoreStateId, userStatsStateId, userName]);

  return data;
};
