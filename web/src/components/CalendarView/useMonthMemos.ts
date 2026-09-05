import { create } from "@bufbuild/protobuf";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { memoServiceClient } from "@/connect";
import { useView } from "@/contexts/ViewContext";
import { memoKeys } from "@/hooks/useMemoQueries";
import { getLocalMonthTimestampRange, withTimestampRange } from "@/lib/calendar-utils";
import { State } from "@/types/proto/api/v1/common_pb";
import { ListMemosRequestSchema, type Memo } from "@/types/proto/api/v1/memo_service_pb";
import { type BuildCalendarMonthModelOptions, buildCalendarMonthModel } from "./dayModel";

/** A realistic personal month fits one page; the loop below still drains any that do not. */
const MONTH_PAGE_SIZE = 500;
const NO_MEMOS: Memo[] = [];

export interface UseMonthMemosOptions extends BuildCalendarMonthModelOptions {
  /** `YYYY-MM` */
  month: string;
  /** CEL clauses fixing whose memos and which collection; the month range is added here. */
  filter?: string;
  enabled?: boolean;
}

/** Every page of the month: a partial month would understate counts and drop rows. */
const listWholeMonth = async (filter: string | undefined, orderBy: string): Promise<Memo[]> => {
  const memos: Memo[] = [];
  let pageToken = "";
  do {
    const response = await memoServiceClient.listMemos(
      create(ListMemosRequestSchema, { state: State.NORMAL, filter, orderBy, pageSize: MONTH_PAGE_SIZE, pageToken }),
    );
    memos.push(...response.memos);
    pageToken = response.nextPageToken;
  } while (pageToken);
  return memos;
};

/**
 * Every memo of one month, folded into per-day summaries for the grid. Lives under the memo
 * list cache key so the create/update/delete mutations invalidate it like any other list.
 */
export const useMonthMemos = ({ month, filter, enabled = true, isRedacted }: UseMonthMemosOptions) => {
  const { timeBasis } = useView();
  const monthFilter = withTimestampRange(filter, getLocalMonthTimestampRange(month), timeBasis);
  const orderBy = `${timeBasis} asc`;

  const query = useQuery({
    queryKey: [...memoKeys.lists(), "calendar-month", { filter: monthFilter, orderBy }],
    queryFn: () => listWholeMonth(monthFilter, orderBy),
    enabled,
    staleTime: 1000 * 60,
  });

  const memos = query.data ?? NO_MEMOS;
  const model = useMemo(() => buildCalendarMonthModel(memos, timeBasis, { isRedacted }), [memos, timeBasis, isRedacted]);
  return { model, isLoading: query.isLoading };
};
