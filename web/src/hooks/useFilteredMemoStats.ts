import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import { countBy } from "lodash-es";
import { useMemo } from "react";
import type { MemoExplorerContext } from "@/components/MemoExplorer";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemos } from "@/hooks/useMemoQueries";
import { useUserStats } from "@/hooks/useUserQueries";
import type { StatisticsData } from "@/types/statistics";

export interface FilteredMemoStats {
  statistics: StatisticsData;
  tags: Record<string, number>;
  loading: boolean;
}

export interface UseFilteredMemoStatsOptions {
  userName?: string;
  context?: MemoExplorerContext;
}

const toDateString = (date: Date) => dayjs(date).format("YYYY-MM-DD");

export const useFilteredMemoStats = (options: UseFilteredMemoStatsOptions = {}): FilteredMemoStats => {
  const { userName, context } = options;
  const currentUser = useCurrentUser();

  // home/profile: use backend per-user stats (full tag set, not page-limited)
  const { data: userStats, isLoading: isLoadingUserStats } = useUserStats(userName);

  // explore: fetch memos with visibility filter to exclude private content.
  // ListMemos AND's the request filter with the server's auth filter, so private
  // memos are always excluded regardless of backend version.
  // other contexts: fetch with default params for the fallback memo-based path.
  const exploreVisibilityFilter = currentUser != null ? 'visibility in ["PUBLIC", "PROTECTED"]' : 'visibility in ["PUBLIC"]';
  const memoQueryParams = context === "explore" ? { filter: exploreVisibilityFilter, pageSize: 1000 } : {};
  const { data: memosResponse, isLoading: isLoadingMemos } = useMemos(memoQueryParams);

  const data = useMemo(() => {
    const loading = isLoadingUserStats || isLoadingMemos;
    let activityStats: Record<string, number> = {};
    let tagCount: Record<string, number> = {};

    if (context === "explore") {
      // Tags and activity stats from visibility-filtered memos (no private content).
      for (const memo of memosResponse?.memos ?? []) {
        for (const tag of memo.tags ?? []) {
          tagCount[tag] = (tagCount[tag] ?? 0) + 1;
        }
      }
      const displayDates = (memosResponse?.memos ?? [])
        .map((memo) => (memo.displayTime ? timestampDate(memo.displayTime) : undefined))
        .filter((date): date is Date => date !== undefined)
        .map(toDateString);
      activityStats = countBy(displayDates);
    } else if (userName && userStats) {
      // home/profile: use backend per-user stats
      if (userStats.memoDisplayTimestamps && userStats.memoDisplayTimestamps.length > 0) {
        activityStats = countBy(
          userStats.memoDisplayTimestamps
            .map((ts) => (ts ? timestampDate(ts) : undefined))
            .filter((date): date is Date => date !== undefined)
            .map(toDateString),
        );
      }
      if (userStats.tagCount) {
        tagCount = userStats.tagCount;
      }
    } else if (memosResponse?.memos) {
      // archived/fallback: compute from cached memos
      const displayDates = memosResponse.memos
        .map((memo) => (memo.displayTime ? timestampDate(memo.displayTime) : undefined))
        .filter((date): date is Date => date !== undefined)
        .map(toDateString);
      activityStats = countBy(displayDates);
      for (const memo of memosResponse.memos) {
        for (const tag of memo.tags ?? []) {
          tagCount[tag] = (tagCount[tag] || 0) + 1;
        }
      }
    }

    return { statistics: { activityStats }, tags: tagCount, loading };
  }, [context, userName, userStats, memosResponse, isLoadingUserStats, isLoadingMemos]);

  return data;
};
