import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import { useMemo } from "react";
import { useView } from "@/contexts/ViewContext";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";

export interface UseMemoSortingOptions {
  pinnedFirst?: boolean;
  state?: State;
}

export interface UseMemoSortingResult {
  listSort: (memos: Memo[]) => Memo[];
  orderBy: string;
}

export const useMemoSorting = (options: UseMemoSortingOptions = {}): UseMemoSortingResult => {
  const { pinnedFirst = false, state = State.NORMAL } = options;
  const { orderByTimeAsc } = useView();

  // Generate orderBy string for API
  const orderBy = useMemo(() => {
    const timeOrder = orderByTimeAsc ? "display_time asc" : "display_time desc";
    return pinnedFirst ? `pinned desc, ${timeOrder}` : timeOrder;
  }, [pinnedFirst, orderByTimeAsc]);

  // Generate listSort function for client-side sorting
  const listSort = useMemo(() => {
    return (memos: Memo[]): Memo[] => {
      return memos
        .filter((memo) => memo.state === state)
        .sort((a, b) => {
          // First, sort by pinned status if enabled
          if (pinnedFirst && a.pinned !== b.pinned) {
            return b.pinned ? 1 : -1;
          }

          // Then sort by display time
          const aTime = a.displayTime ? timestampDate(a.displayTime) : undefined;
          const bTime = b.displayTime ? timestampDate(b.displayTime) : undefined;
          return orderByTimeAsc ? dayjs(aTime).unix() - dayjs(bTime).unix() : dayjs(bTime).unix() - dayjs(aTime).unix();
        });
    };
  }, [pinnedFirst, state, orderByTimeAsc]);

  return { listSort, orderBy };
};
