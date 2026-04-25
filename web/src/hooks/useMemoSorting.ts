import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import { useMemo } from "react";
import { type MemoSortTimeField, useView } from "@/contexts/ViewContext";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

export interface UseMemoSortingOptions {
  pinnedFirst?: boolean;
  state?: State;
}

export interface UseMemoSortingResult {
  listSort: (memos: Memo[]) => Memo[];
  orderBy: string;
}

const getMemoSortTime = (memo: Memo, field: MemoSortTimeField): Date | undefined => {
  const timestamp = field === "update_time" ? memo.updateTime : memo.createTime;
  return timestamp ? timestampDate(timestamp) : undefined;
};

export const useMemoSorting = (options: UseMemoSortingOptions = {}): UseMemoSortingResult => {
  const { pinnedFirst = false, state = State.NORMAL } = options;
  const { orderByTimeAsc, sortTimeField } = useView();

  // Generate orderBy string for API
  const orderBy = useMemo(() => {
    const timeOrder = orderByTimeAsc ? `${sortTimeField} asc` : `${sortTimeField} desc`;
    return pinnedFirst ? `pinned desc, ${timeOrder}` : timeOrder;
  }, [pinnedFirst, orderByTimeAsc, sortTimeField]);

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

          // Then sort by the selected time field.
          const aTime = getMemoSortTime(a, sortTimeField);
          const bTime = getMemoSortTime(b, sortTimeField);
          return orderByTimeAsc ? dayjs(aTime).unix() - dayjs(bTime).unix() : dayjs(bTime).unix() - dayjs(aTime).unix();
        });
    };
  }, [pinnedFirst, state, orderByTimeAsc, sortTimeField]);

  return { listSort, orderBy };
};
