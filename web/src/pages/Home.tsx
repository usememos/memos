import { Button } from "@mui/joy";
import clsx from "clsx";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import Empty from "@/components/Empty";
import { HomeSidebar, HomeSidebarDrawer } from "@/components/HomeSidebar";
import Icon from "@/components/Icon";
import MemoEditor from "@/components/MemoEditor";
import MemoFilters from "@/components/MemoFilters";
import MemoView from "@/components/MemoView";
import MobileHeader from "@/components/MobileHeader";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import useCurrentUser from "@/hooks/useCurrentUser";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { useMemoFilterStore, useMemoList, useMemoStore } from "@/store/v1";
import { RowStatus } from "@/types/proto/api/v1/common";
import { useTranslate } from "@/utils/i18n";

const Home = () => {
  const t = useTranslate();
  const { md } = useResponsiveWidth();
  const user = useCurrentUser();
  const memoStore = useMemoStore();
  const memoList = useMemoList();
  const memoFilterStore = useMemoFilterStore();
  const [isRequesting, setIsRequesting] = useState(true);
  const [nextPageToken, setNextPageToken] = useState<string>("");
  const sortedMemos = memoList.value
    .filter((memo) => memo.rowStatus === RowStatus.ACTIVE)
    .sort((a, b) =>
      memoFilterStore.orderByTimeAsc
        ? dayjs(a.displayTime).unix() - dayjs(b.displayTime).unix()
        : dayjs(b.displayTime).unix() - dayjs(a.displayTime).unix(),
    )
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  useEffect(() => {
    memoList.reset();
    fetchMemos("");
  }, [memoFilterStore.filters]);

  const fetchMemos = async (nextPageToken: string) => {
    setIsRequesting(true);
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
        const timestampAfter = new Date(filter.value).getTime() / 1000;
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
    const response = await memoStore.fetchMemos({
      pageSize: DEFAULT_LIST_MEMOS_PAGE_SIZE,
      filter: filters.join(" && "),
      pageToken: nextPageToken,
    });
    setIsRequesting(false);
    setNextPageToken(response.nextPageToken);
  };

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
            {sortedMemos.map((memo) => (
              <MemoView key={`${memo.name}-${memo.updateTime}`} memo={memo} showVisibility showPinned compact />
            ))}
            {isRequesting ? (
              <div className="flex flex-row justify-center items-center w-full my-4 text-gray-400">
                <Icon.Loader className="w-4 h-auto animate-spin mr-1" />
                <p className="text-sm italic">{t("memo.fetching-data")}</p>
              </div>
            ) : !nextPageToken ? (
              sortedMemos.length === 0 && (
                <div className="w-full mt-12 mb-8 flex flex-col justify-center items-center italic">
                  <Empty />
                  <p className="mt-2 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
                </div>
              )
            ) : (
              <div className="w-full flex flex-row justify-center items-center my-4">
                <Button variant="plain" endDecorator={<Icon.ArrowDown className="w-5 h-auto" />} onClick={() => fetchMemos(nextPageToken)}>
                  {t("memo.fetch-more")}
                </Button>
              </div>
            )}
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
