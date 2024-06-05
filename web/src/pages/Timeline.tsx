import { Button, IconButton } from "@mui/joy";
import clsx from "clsx";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import useLocalStorage from "react-use/lib/useLocalStorage";
import ActivityCalendar from "@/components/ActivityCalendar";
import Empty from "@/components/Empty";
import Icon from "@/components/Icon";
import showMemoEditorDialog from "@/components/MemoEditor/MemoEditorDialog";
import MemoView from "@/components/MemoView";
import MobileHeader from "@/components/MobileHeader";
import { TimelineSidebar, TimelineSidebarDrawer } from "@/components/TimelineSidebar";
import { memoServiceClient } from "@/grpcweb";
import { DAILY_TIMESTAMP, DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import { getTimeStampByDate } from "@/helpers/datetime";
import useCurrentUser from "@/hooks/useCurrentUser";
import useFilterWithUrlParams from "@/hooks/useFilterWithUrlParams";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import i18n from "@/i18n";
import { Routes } from "@/router";
import { useMemoList, useMemoStore } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";

const Timeline = () => {
  const t = useTranslate();
  const { md } = useResponsiveWidth();
  const user = useCurrentUser();
  const memoStore = useMemoStore();
  const memoList = useMemoList();
  const [, setLastVisited] = useLocalStorage<string>("lastVisited", Routes.TIMELINE);
  const filter = useFilterWithUrlParams();
  const [activityStats, setActivityStats] = useState<Record<string, number>>({});
  const [selectedDateString, setSelectedDateString] = useState<string>(new Date().toDateString());
  const [isRequesting, setIsRequesting] = useState(true);
  const [nextPageToken, setNextPageToken] = useState<string>("");
  const sortedMemos = memoList.value.sort((a, b) => getTimeStampByDate(a.displayTime) - getTimeStampByDate(b.displayTime));
  const monthString = dayjs(selectedDateString).format("YYYY-MM");

  useEffect(() => {
    setLastVisited(Routes.TIMELINE);
  }, []);

  useEffect(() => {
    memoList.reset();
    fetchMemos("");
  }, [selectedDateString, filter.text, filter.tag, filter.memoPropertyFilter]);

  useEffect(() => {
    (async () => {
      const filters = [`row_status == "NORMAL"`];
      const { stats } = await memoServiceClient.getUserMemosStats({
        name: user.name,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        filter: filters.join(" && "),
      });

      setActivityStats(
        Object.fromEntries(
          Object.entries(stats).filter(([date]) => {
            return dayjs(date).format("YYYY-MM") === monthString;
          }),
        ),
      );
    })();
  }, [sortedMemos.length]);

  const fetchMemos = async (nextPageToken: string) => {
    setIsRequesting(true);
    const filters = [`creator == "${user.name}"`, `row_status == "NORMAL"`];
    const contentSearch: string[] = [];
    if (filter.text) {
      contentSearch.push(JSON.stringify(filter.text));
    }
    if (contentSearch.length > 0) {
      filters.push(`content_search == [${contentSearch.join(", ")}]`);
    }
    if (filter.tag) {
      filters.push(`tag == "${filter.tag}"`);
    }
    if (filter.memoPropertyFilter) {
      if (filter.memoPropertyFilter.hasLink) {
        filters.push(`has_link == true`);
      }
      if (filter.memoPropertyFilter.hasTaskList) {
        filters.push(`has_task_list == true`);
      }
      if (filter.memoPropertyFilter.hasCode) {
        filters.push(`has_code == true`);
      }
    }
    if (selectedDateString) {
      const selectedDateStamp = getTimeStampByDate(selectedDateString);
      filters.push(
        ...[`display_time_after == ${selectedDateStamp / 1000}`, `display_time_before == ${(selectedDateStamp + DAILY_TIMESTAMP) / 1000}`],
      );
    }
    const response = await memoStore.fetchMemos({
      pageSize: DEFAULT_LIST_MEMOS_PAGE_SIZE,
      filter: filters.join(" && "),
      pageToken: nextPageToken,
    });
    setIsRequesting(false);
    setNextPageToken(response.nextPageToken);
  };

  const handleSelectedDataChange = (date: string) => {
    if (dayjs(date).isValid()) {
      setSelectedDateString(new Date(date).toDateString());
    }
  };

  const handleNewMemo = () => {
    showMemoEditorDialog({});
  };

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      {!md && (
        <MobileHeader>
          <TimelineSidebarDrawer />
        </MobileHeader>
      )}
      <div className={clsx("w-full flex flex-row justify-start items-start px-4 sm:px-6 gap-4")}>
        <div className={clsx(md ? "w-[calc(100%-15rem)]" : "w-full")}>
          <div className="w-full shadow flex flex-col justify-start items-start px-4 py-3 rounded-xl bg-white dark:bg-zinc-800 text-black dark:text-gray-300">
            <div className="relative w-full flex flex-row justify-between items-center">
              <div>
                <div
                  className="py-1 flex flex-row justify-start items-center select-none opacity-80"
                  onClick={() => setSelectedDateString(new Date().toDateString())}
                >
                  <Icon.GanttChartSquare className="w-6 h-auto mr-1 opacity-80" />
                  <span className="text-lg">{t("timeline.title")}</span>
                </div>
              </div>
              <div className="flex justify-end items-center gap-2">
                <IconButton variant="outlined" size="sm" onClick={() => handleNewMemo()}>
                  <Icon.Plus className="w-5 h-auto" />
                </IconButton>
              </div>
            </div>
            <div className="w-full h-auto flex flex-col justify-start items-start">
              <div className="flex flex-col justify-start items-start w-full mt-2">
                <div className="w-full flex shrink-0 flex-row justify-between pl-1 mt-1 mb-3">
                  <div className="w-auto flex flex-col">
                    <div className="relative font-medium text-3xl sm:text-4xl">
                      {new Date(selectedDateString).toLocaleDateString(i18n.language, { month: "short", day: "numeric" })}
                      <input
                        className="inset-0 absolute z-1 opacity-0"
                        type="date"
                        max={dayjs().format("YYYY-MM-DD")}
                        value={dayjs(selectedDateString).format("YYYY-MM-DD")}
                        onFocus={(e: any) => e.target.showPicker()}
                        onChange={(e) => handleSelectedDataChange(e.target.value)}
                      />
                    </div>
                    <span className="opacity-60 text-lg">{dayjs(monthString).year()}</span>
                  </div>
                  <ActivityCalendar
                    month={monthString}
                    selectedDate={selectedDateString}
                    data={activityStats}
                    onClick={(date) => setSelectedDateString(date)}
                  />
                </div>

                <div className={clsx("w-full flex flex-col justify-start items-start")}>
                  {sortedMemos.map((memo) => (
                    <MemoView
                      key={`${memo.name}-${memo.displayTime}`}
                      className="!border w-full !border-gray-100 dark:!border-zinc-700"
                      memo={memo}
                      displayTimeFormat="time"
                      compact
                    />
                  ))}
                </div>
              </div>

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
                  <Button
                    variant="plain"
                    endDecorator={<Icon.ArrowDown className="w-5 h-auto" />}
                    onClick={() => fetchMemos(nextPageToken)}
                  >
                    {t("memo.fetch-more")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
        {md && (
          <div className="sticky top-0 left-0 shrink-0 -mt-6 w-56 h-full">
            <TimelineSidebar className="py-6" />
          </div>
        )}
      </div>
    </section>
  );
};

export default Timeline;
