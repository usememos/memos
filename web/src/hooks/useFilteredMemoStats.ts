import dayjs from "dayjs";
import { countBy } from "lodash-es";
import { useEffect, useState } from "react";
import { memoStore } from "@/store";
import type { StatisticsData } from "@/types/statistics";

export interface FilteredMemoStats {
  statistics: StatisticsData;
  tags: Record<string, number>;
  loading: boolean;
}

/**
 * Hook to compute statistics and tags from memos in the store cache.
 *
 * This provides a unified approach for all pages (Home, Explore, Archived, Profile):
 * - Uses memos already loaded in the store by PagedMemoList
 * - Computes statistics and tags from those cached memos
 * - Updates automatically when memos are created, updated, or deleted
 * - No separate API call needed, reducing network overhead
 *
 * @returns Object with statistics data, tag counts, and loading state
 *
 * Note: This hook now computes stats from the memo store cache rather than
 * making a separate API call. It relies on PagedMemoList to populate the store.
 */
export const useFilteredMemoStats = (): FilteredMemoStats => {
  const [data, setData] = useState<FilteredMemoStats>({
    statistics: {
      activityStats: {},
    },
    tags: {},
    loading: false,
  });
  // React to memo store changes (create, update, delete)
  const memoStoreStateId = memoStore.state.stateId;

  useEffect(() => {
    // Compute statistics and tags from memos already in the store
    // This avoids making a separate API call and relies on PagedMemoList to populate the store
    const computeStatsFromCache = () => {
      const displayTimeList: Date[] = [];
      const tagCount: Record<string, number> = {};

      // Use memos already loaded in the store
      const memos = memoStore.state.memos;

      for (const memo of memos) {
        // Add display time for calendar
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

      // Compute activity calendar data
      const activityStats = countBy(displayTimeList.map((date) => dayjs(date).format("YYYY-MM-DD")));

      setData({
        statistics: { activityStats },
        tags: tagCount,
        loading: false,
      });
    };

    computeStatsFromCache();
  }, [memoStoreStateId]);

  return data;
};
