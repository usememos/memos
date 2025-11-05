import dayjs from "dayjs";
import { useMemo } from "react";
import { viewStore } from "@/store";
import { State } from "@/types/proto/api/v1/common";
import { Memo } from "@/types/proto/api/v1/memo_service";

export interface UseMemoSortingOptions {
  /**
   * Whether to sort pinned memos first
   * Default: false
   */
  pinnedFirst?: boolean;

  /**
   * State to filter memos by (NORMAL, ARCHIVED, etc.)
   * Default: State.NORMAL
   */
  state?: State;
}

export interface UseMemoSortingResult {
  /**
   * Sort function to pass to PagedMemoList's listSort prop
   */
  listSort: (memos: Memo[]) => Memo[];

  /**
   * Order by string to pass to PagedMemoList's orderBy prop
   */
  orderBy: string;
}

/**
 * Hook to generate memo sorting logic based on options.
 *
 * This hook consolidates sorting logic that was previously duplicated
 * across Home, Explore, Archived, and UserProfile pages.
 *
 * @param options - Configuration for sorting
 * @returns Object with listSort function and orderBy string
 *
 * @example
 * // Home page - pinned first, then by time
 * const { listSort, orderBy } = useMemoSorting({
 *   pinnedFirst: true,
 *   state: State.NORMAL
 * });
 *
 * @example
 * // Explore page - only by time
 * const { listSort, orderBy } = useMemoSorting({
 *   pinnedFirst: false,
 *   state: State.NORMAL
 * });
 */
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
