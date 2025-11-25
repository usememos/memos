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

/**
 * Convert user name to user stats key.
 * Backend returns UserStats with name "users/{id}/stats" but we pass "users/{id}"
 * @param userName - User name in format "users/{id}"
 * @returns Stats key in format "users/{id}/stats"
 */
const getUserStatsKey = (userName: string): string => {
  return `${userName}/stats`;
};

export interface UseFilteredMemoStatsOptions {
  /**
   * User name to fetch stats for (e.g., "users/123")
   *
   * When provided:
   * - Fetches backend user stats via GetUserStats API
   * - Returns unfiltered tags and activity (all NORMAL memos for that user)
   * - Tags remain stable even when memo filters are applied
   *
   * When undefined:
   * - Computes stats from cached memos in the store
   * - Reflects current filters (useful for Explore/Archived pages)
   *
   * IMPORTANT: Backend user stats only include NORMAL (non-archived) memos.
   * Do NOT use for Archived page context.
   */
  userName?: string;
}

/**
 * Hook to compute statistics and tags for the sidebar.
 *
 * Data sources by context:
 * - **Home/Profile**: Uses backend UserStats API (unfiltered, normal memos only)
 * - **Archived/Explore**: Computes from cached memos (filtered by page context)
 *
 * Benefits of using backend stats:
 * - Tag list remains stable when memo filters are applied
 * - Activity calendar shows full history, not just filtered results
 * - Prevents "disappearing tags" issue when filtering by tag
 *
 * @param options - Configuration options
 * @returns Object with statistics data, tag counts, and loading state
 */
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
            activityStats = countBy(userStats.memoDisplayTimestamps.map((date) => dayjs(date).format("YYYY-MM-DD")));
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
          if (memo.displayTime) {
            displayTimeList.push(memo.displayTime);
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
