import clsx from "clsx";
import dayjs from "dayjs";
import { useMemo } from "react";
import { HomeSidebar, HomeSidebarDrawer } from "@/components/HomeSidebar";
import MemoEditor from "@/components/MemoEditor";
import MemoFilters from "@/components/MemoFilters";
import MemoView from "@/components/MemoView";
import MobileHeader from "@/components/MobileHeader";
import PagedMemoList from "@/components/PagedMemoList";
import PinnedMemoList from "@/components/PinnedMemoList";
import useCurrentUser from "@/hooks/useCurrentUser";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { useMemoFilterStore } from "@/store/v1";
import { RowStatus } from "@/types/proto/api/v1/common";
import { Memo } from "@/types/proto/api/v1/memo_service";

const Home = () => {
  const { md, lg } = useResponsiveWidth();
  const user = useCurrentUser();
  const memoFilterStore = useMemoFilterStore();

  const memoListFilter = useMemo(() => {
    const filters = [`creator == "${user.name}"`, `row_status == "NORMAL"`, `order_by_pinned == true`];
    const contentSearch: string[] = [];
    const tagSearch: string[] = [];
    for (const filter of memoFilterStore.filters) {
      if (filter.factor === "contentSearch") {
        contentSearch.push(`"${filter.value}"`);
      } else if (filter.factor === "tagSearch") {
        tagSearch.push(`"${filter.value}"`);
      } else if (filter.factor === "property.hasLink") {
        filters.push(`has_link == true`);
      } else if (filter.factor === "property.hasTaskList") {
        filters.push(`has_task_list == true`);
      } else if (filter.factor === "property.hasCode") {
        filters.push(`has_code == true`);
      } else if (filter.factor === "displayTime") {
        const filterDate = new Date(filter.value);
        const filterUtcTimestamp = filterDate.getTime() + filterDate.getTimezoneOffset() * 60 * 1000;
        const timestampAfter = filterUtcTimestamp / 1000;
        filters.push(`display_time_after == ${timestampAfter}`);
        filters.push(`display_time_before == ${timestampAfter + 60 * 60 * 24}`);
      }
    }
    if (memoFilterStore.orderByTimeAsc) {
      filters.push(`order_by_time_asc == true`);
    }
    if (contentSearch.length > 0) {
      filters.push(`content_search == [${contentSearch.join(", ")}]`);
    }
    if (tagSearch.length > 0) {
      filters.push(`tag_search == [${tagSearch.join(", ")}]`);
    }
    return filters.join(" && ");
  }, [user, memoFilterStore.filters, memoFilterStore.orderByTimeAsc]);

  return (
    <section className="@container w-full h-[100vh] flex flex-col justify-start items-center">
      {!md && (
        <MobileHeader>
          <HomeSidebarDrawer />
        </MobileHeader>
      )}
      <div className={clsx("w-full flex flex-row justify-start items-start", md ? "h-full" : "h-[calc(100vh-60px)]")}>
        {md && (
          <div className="flex-shrink-0 w-64 px-4 border-r border-zinc-200 dark:border-zinc-800">
            <HomeSidebar className="py-6" />
          </div>
        )}
        <div className="flex-1 flex gap-4 px-4 sm:px-6 sm:pt-3 md:pt-6 h-full overflow-x-hidden">
          <div className="lg:w-1/2 flex-grow flex flex-col h-full overflow-auto">
            <MemoEditor className="mb-2" cacheKey="home-memo-editor" />
            <MemoFilters />
            <PagedMemoList
              renderer={(memo: Memo) => (
                <MemoView key={`${memo.name}-${memo.displayTime}`} memo={memo} showVisibility showPinned showExport compact />
              )}
              listSort={(memos: Memo[]) =>
                memos
                  .filter((memo) => memo.rowStatus === RowStatus.ACTIVE && (lg ? !memo.pinned : true))
                  .sort((a, b) =>
                    memoFilterStore.orderByTimeAsc
                      ? dayjs(a.displayTime).unix() - dayjs(b.displayTime).unix()
                      : dayjs(b.displayTime).unix() - dayjs(a.displayTime).unix(),
                  )
                  .sort((a, b) => Number(b.pinned) - Number(a.pinned))
              }
              filter={memoListFilter}
            />
          </div>
          {lg && (
            <div className="w-1/2 flex flex-col h-full overflow-auto">
              <PinnedMemoList
                renderer={(memo: Memo) => (
                  <MemoView key={`${memo.name}-${memo.displayTime}`} memo={memo} showVisibility showPinned showExport compact />
                )}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Home;
