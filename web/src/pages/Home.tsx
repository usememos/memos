import clsx from "clsx";
import dayjs from "dayjs";
import { useMemo } from "react";
import { HomeSidebar, HomeSidebarDrawer } from "@/components/HomeSidebar";
import MemoEditor from "@/components/MemoEditor";
import MemoFilters from "@/components/MemoFilters";
import MemoView from "@/components/MemoView";
import MobileHeader from "@/components/MobileHeader";
import PagedMemoList from "@/components/PagedMemoList";
import useCurrentUser from "@/hooks/useCurrentUser";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { useMemoFilterStore } from "@/store/v1";
import { State } from "@/types/proto/api/v1/common";
import { Memo } from "@/types/proto/api/v1/memo_service";

const Home = () => {
  const { md } = useResponsiveWidth();
  const user = useCurrentUser();
  const memoFilterStore = useMemoFilterStore();

  const memoListFilter = useMemo(() => {
    const filters = [`creator == "${user.name}"`, `state == "NORMAL"`, `order_by_pinned == true`];
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
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      {!md && (
        <MobileHeader>
          <HomeSidebarDrawer />
        </MobileHeader>
      )}
      <div className={clsx("w-full flex flex-row justify-start items-start px-4 sm:px-6 gap-4")}>
        <div className={clsx(md ? "w-[calc(100%-15rem)]" : "w-full")}>
          <MemoEditor className="mb-2" cacheKey="home-memo-editor" />
          <MemoFilters />
          <div className="flex flex-col justify-start items-start w-full max-w-full">
            <PagedMemoList
              renderer={(memo: Memo) => <MemoView key={`${memo.name}-${memo.displayTime}`} memo={memo} showVisibility showPinned compact />}
              listSort={(memos: Memo[]) =>
                memos
                  .filter((memo) => memo.state === State.NORMAL)
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
        </div>
        {md && (
          <div className="sticky top-0 left-0 shrink-0 -mt-6 w-56 h-full">
            <HomeSidebar className="py-6" />
          </div>
        )}
      </div>
    </section>
  );
};

export default Home;
