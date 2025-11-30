import dayjs from "dayjs";
import { useMemo } from "react";
import { viewStore } from "@/store";
import { State } from "@/types/proto/api/v1/common";
import { Memo } from "@/types/proto/api/v1/memo_service";

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

  // Generate orderBy string for API
  const orderBy = useMemo(() => {
    const timeOrder = viewStore.state.orderByTimeAsc ? "display_time asc" : "display_time desc";
    return pinnedFirst ? `pinned desc, ${timeOrder}` : timeOrder;
  }, [pinnedFirst, viewStore.state.orderByTimeAsc]);

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
          return viewStore.state.orderByTimeAsc
            ? dayjs(a.displayTime).unix() - dayjs(b.displayTime).unix()
            : dayjs(b.displayTime).unix() - dayjs(a.displayTime).unix();
        });
    };
  }, [pinnedFirst, state, viewStore.state.orderByTimeAsc]);

  return { listSort, orderBy };
};
