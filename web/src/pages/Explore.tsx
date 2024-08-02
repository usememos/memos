import { Button } from "@mui/joy";
import clsx from "clsx";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import Empty from "@/components/Empty";
import { ExploreSidebar, ExploreSidebarDrawer } from "@/components/ExploreSidebar";
import Icon from "@/components/Icon";
import MemoFilters from "@/components/MemoFilters";
import MemoView from "@/components/MemoView";
import MobileHeader from "@/components/MobileHeader";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import useCurrentUser from "@/hooks/useCurrentUser";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { useMemoFilterStore, useMemoList, useMemoStore } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";

const Explore = () => {
  const t = useTranslate();
  const { md } = useResponsiveWidth();
  const user = useCurrentUser();
  const memoStore = useMemoStore();
  const memoList = useMemoList();
  const memoFilterStore = useMemoFilterStore();
  const [isRequesting, setIsRequesting] = useState(true);
  const [nextPageToken, setNextPageToken] = useState<string>("");
  const sortedMemos = memoList.value.sort((a, b) =>
    memoFilterStore.orderByTimeAsc
      ? dayjs(a.displayTime).unix() - dayjs(b.displayTime).unix()
      : dayjs(b.displayTime).unix() - dayjs(a.displayTime).unix(),
  );

  useEffect(() => {
    memoList.reset();
    fetchMemos("");
  }, [memoFilterStore.filters]);

  const fetchMemos = async (nextPageToken: string) => {
    setIsRequesting(true);
    const filters = [`row_status == "NORMAL"`, `visibilities == [${user ? "'PUBLIC', 'PROTECTED'" : "'PUBLIC'"}]`];
    const contentSearch: string[] = [];
    const tagSearch: string[] = [];
    for (const filter of memoFilterStore.filters) {
      if (filter.factor === "contentSearch") {
        contentSearch.push(`"${filter.value}"`);
      } else if (filter.factor === "tagSearch") {
        tagSearch.push(`"${filter.value}"`);
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
          <ExploreSidebarDrawer />
        </MobileHeader>
      )}
      <div className={clsx("w-full flex flex-row justify-start items-start px-4 sm:px-6 gap-4")}>
        <div className={clsx(md ? "w-[calc(100%-15rem)]" : "w-full")}>
          <MemoFilters />
          <div className="flex flex-col justify-start items-start w-full max-w-full">
            {sortedMemos.map((memo) => (
              <MemoView key={`${memo.name}-${memo.updateTime}`} memo={memo} showCreator showVisibility showPinned compact />
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
            <ExploreSidebar className="py-6" />
          </div>
        )}
      </div>
    </section>
  );
};

export default Explore;
