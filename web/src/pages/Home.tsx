import { Button } from "@mui/joy";
import classNames from "classnames";
import { useEffect, useState } from "react";
import Empty from "@/components/Empty";
import HomeSidebar from "@/components/HomeSidebar";
import HomeSidebarDrawer from "@/components/HomeSidebarDrawer";
import Icon from "@/components/Icon";
import MemoEditor from "@/components/MemoEditor";
import MemoFilter from "@/components/MemoFilter";
import MemoView from "@/components/MemoView";
import MobileHeader from "@/components/MobileHeader";
import { DEFAULT_MEMO_LIMIT } from "@/helpers/consts";
import { getTimeStampByDate } from "@/helpers/datetime";
import useCurrentUser from "@/hooks/useCurrentUser";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { useFilterStore } from "@/store/module";
import { useMemoList, useMemoStore } from "@/store/v1";
import { RowStatus } from "@/types/proto/api/v2/common";
import { useTranslate } from "@/utils/i18n";

const Home = () => {
  const t = useTranslate();
  const { md } = useResponsiveWidth();
  const user = useCurrentUser();
  const filterStore = useFilterStore();
  const memoStore = useMemoStore();
  const memoList = useMemoList();
  const [isRequesting, setIsRequesting] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const { tag: tagQuery, text: textQuery } = filterStore.state;
  const sortedMemos = memoList.value
    .filter((memo) => memo.rowStatus === RowStatus.ACTIVE)
    .sort((a, b) => getTimeStampByDate(b.displayTime) - getTimeStampByDate(a.displayTime))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  useEffect(() => {
    memoList.reset();
    fetchMemos();
  }, [tagQuery, textQuery]);

  const fetchMemos = async () => {
    const filters = [`creator == "${user.name}"`, `row_status == "NORMAL"`, `order_by_pinned == true`];
    const contentSearch: string[] = [];
    if (tagQuery) {
      contentSearch.push(`"#${tagQuery}"`);
    }
    if (textQuery) {
      contentSearch.push(`"${textQuery}"`);
    }
    if (contentSearch.length > 0) {
      filters.push(`content_search == [${contentSearch.join(", ")}]`);
    }
    setIsRequesting(true);
    const data = await memoStore.fetchMemos({
      filter: filters.join(" && "),
      limit: DEFAULT_MEMO_LIMIT,
      offset: memoList.size(),
    });
    setIsRequesting(false);
    setIsComplete(data.length < DEFAULT_MEMO_LIMIT);
  };

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      {!md && (
        <MobileHeader>
          <HomeSidebarDrawer />
        </MobileHeader>
      )}
      <div className={classNames("w-full flex flex-row justify-start items-start px-4 sm:px-6 gap-4")}>
        <div className={classNames(md ? "w-[calc(100%-15rem)]" : "w-full")}>
          <MemoEditor className="mb-2" cacheKey="home-memo-editor" />
          <div className="flex flex-col justify-start items-start w-full max-w-full pb-28">
            <MemoFilter className="px-2 pb-2" />
            {sortedMemos.map((memo) => (
              <MemoView key={`${memo.id}-${memo.updateTime}`} memo={memo} showVisibility showPinned />
            ))}
            {isRequesting ? (
              <div className="flex flex-col justify-start items-center w-full my-4">
                <p className="text-sm text-gray-400 italic">{t("memo.fetching-data")}</p>
              </div>
            ) : isComplete ? (
              sortedMemos.length === 0 && (
                <div className="w-full mt-12 mb-8 flex flex-col justify-center items-center italic">
                  <Empty />
                  <p className="mt-2 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
                </div>
              )
            ) : (
              <div className="w-full flex flex-row justify-center items-center my-4">
                <Button variant="plain" endDecorator={<Icon.ArrowDown className="w-5 h-auto" />} onClick={fetchMemos}>
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
