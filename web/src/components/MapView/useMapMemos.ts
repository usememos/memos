import { useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useView } from "@/contexts/ViewContext";
import { useMemoFilters } from "@/hooks/useMemoFilters";
import { useInfiniteMemos } from "@/hooks/useMemoQueries";
import { combineCELFilters } from "@/lib/cel-filter";
import { State } from "@/types/proto/api/v1/common_pb";
import { mapMemos } from "./model";

/** What the map can show; the sidebar counts against the same scope. */
export const MAP_MEMO_FILTER = "has_location";

export function useMapMemos() {
  const { isUserSettingsInitialized } = useAuth();
  const { memoFilter } = useSpaceContext();
  const { timeBasis } = useView();
  const viewFilter = useMemoFilters({ includeMemoViews: true, includePinned: false });
  const filter = combineCELFilters(memoFilter, viewFilter, MAP_MEMO_FILTER);
  const query = useInfiniteMemos(
    { filter, state: State.NORMAL, pageSize: 500, orderBy: `${timeBasis} desc, name desc` },
    { enabled: isUserSettingsInitialized },
  );
  const { hasNextPage, isFetching, isError, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetching && !isError) void fetchNextPage().catch(() => {});
  }, [hasNextPage, isFetching, isError, fetchNextPage, query.data?.pages.length]);
  const memos = useMemo(
    () => mapMemos(isUserSettingsInitialized ? query.data?.pages : undefined, timeBasis),
    [query.data, timeBasis, isUserSettingsInitialized],
  );
  const complete = isUserSettingsInitialized && query.isSuccess && !query.hasNextPage && !query.isFetching;
  return { ...query, memos, complete, retry: () => (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch()) };
}
