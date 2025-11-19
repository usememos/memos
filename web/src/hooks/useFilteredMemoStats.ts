import dayjs from "dayjs";
import { countBy } from "lodash-es";
import { useEffect, useState } from "react";
import { memoServiceClient } from "@/grpcweb";
import { memoStore } from "@/store";
import { State } from "@/types/proto/api/v1/common";
import type { StatisticsData } from "@/types/statistics";

export interface FilteredMemoStats {
  statistics: StatisticsData;
  tags: Record<string, number>;
  loading: boolean;
}

/**
 * Hook to fetch and compute statistics and tags from memos matching a filter.
 *
 * This provides a unified approach for all pages (Home, Explore, Archived, Profile):
 * - Uses the same filter as PagedMemoList for consistency
 * - Fetches all memos matching the filter once
 * - Computes statistics and tags from those memos
 * - Stats/tags remain static and don't change when user applies additional filters
 *
 * @param filter - CEL filter expression (same as used for memo list)
 * @param state - Memo state (NORMAL for most pages, ARCHIVED for archived page)
 * @param orderBy - Optional sort order (not used for stats, but ensures consistency)
 * @returns Object with statistics data, tag counts, and loading state
 *
 * @example Home page
 * const { statistics, tags } = useFilteredMemoStats(
 *   `creator_id == ${currentUserId}`,
 *   State.NORMAL
 * );
 *
 * @example Explore page
 * const { statistics, tags } = useFilteredMemoStats(
 *   `visibility in ["PUBLIC", "PROTECTED"]`,
 *   State.NORMAL
 * );
 *
 * @example Archived page
 * const { statistics, tags } = useFilteredMemoStats(
 *   `creator_id == ${currentUserId}`,
 *   State.ARCHIVED
 * );
 */
export const useFilteredMemoStats = (filter?: string, state: State = State.NORMAL, orderBy?: string): FilteredMemoStats => {
  const [data, setData] = useState<FilteredMemoStats>({
    statistics: {
      activityStats: {},
    },
    tags: {},
    loading: true,
  });
  // React to memo store changes (create, update, delete)
  const memoStoreStateId = memoStore.state.stateId;

  useEffect(() => {
    const fetchMemosAndComputeStats = async () => {
      setData((prev) => ({ ...prev, loading: true }));

      try {
        // Fetch all memos matching the filter
        // Use large page size to ensure we get all memos for accurate stats
        const response = await memoServiceClient.listMemos({
          state,
          filter,
          orderBy,
          pageSize: 10000, // Large enough to get all memos
        });

        // Compute statistics and tags from fetched memos
        const displayTimeList: Date[] = [];
        const tagCount: Record<string, number> = {};

        if (response.memos) {
          for (const memo of response.memos) {
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
        }

        // Compute activity calendar data
        const activityStats = countBy(displayTimeList.map((date) => dayjs(date).format("YYYY-MM-DD")));

        setData({
          statistics: { activityStats },
          tags: tagCount,
          loading: false,
        });
      } catch (error) {
        console.error("Failed to fetch memos for statistics:", error);
        setData({
          statistics: {
            activityStats: {},
          },
          tags: {},
          loading: false,
        });
      }
    };

    fetchMemosAndComputeStats();
  }, [filter, state, orderBy, memoStoreStateId]);

  return data;
};
