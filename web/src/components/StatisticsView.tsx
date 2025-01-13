import { Divider, Tooltip } from "@mui/joy";
import clsx from "clsx";
import dayjs from "dayjs";
import { countBy } from "lodash-es";
import { CalendarDaysIcon, CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, Code2Icon, LinkIcon, ListTodoIcon } from "lucide-react";
import { useState } from "react";
import useAsyncEffect from "@/hooks/useAsyncEffect";
import useCurrentUser from "@/hooks/useCurrentUser";
import i18n from "@/i18n";
import { useMemoFilterStore, useUserStatsStore } from "@/store/v1";
import { UserStats_MemoTypeStats } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";
import ActivityCalendar from "./ActivityCalendar";

const StatisticsView = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const memoFilterStore = useMemoFilterStore();
  const userStatsStore = useUserStatsStore();
  const [memoAmount, setMemoAmount] = useState(0);
  const [memoTypeStats, setMemoTypeStats] = useState<UserStats_MemoTypeStats>(UserStats_MemoTypeStats.fromPartial({}));
  const [activityStats, setActivityStats] = useState<Record<string, number>>({});
  const [selectedDate] = useState(new Date());
  const [visibleMonthString, setVisibleMonthString] = useState(dayjs(selectedDate.toDateString()).format("YYYY-MM"));
  const days = Math.ceil((Date.now() - currentUser.createTime!.getTime()) / 86400000);

  const singularOrPluralMemo = (memoAmount > 0 ? t("common.memos") : t("common.memo")).toLowerCase();
  const singularOrPluralDay = (days > 0 ? t("common.days") : t("common.day")).toLowerCase();

  useAsyncEffect(async () => {
    const memoTypeStats = UserStats_MemoTypeStats.fromPartial({});
    const displayTimeList: Date[] = [];
    for (const stats of Object.values(userStatsStore.userStatsByName)) {
      displayTimeList.push(...stats.memoDisplayTimestamps);
      if (stats.memoTypeStats) {
        memoTypeStats.codeCount += stats.memoTypeStats.codeCount;
        memoTypeStats.linkCount += stats.memoTypeStats.linkCount;
        memoTypeStats.todoCount += stats.memoTypeStats.todoCount;
        memoTypeStats.undoCount += stats.memoTypeStats.undoCount;
      }
    }
    setMemoTypeStats(memoTypeStats);
    setMemoAmount(displayTimeList.length);
    setActivityStats(countBy(displayTimeList.map((date) => dayjs(date).format("YYYY-MM-DD"))));
  }, [userStatsStore.stateId]);

  const onCalendarClick = (date: string) => {
    memoFilterStore.removeFilter((f) => f.factor === "displayTime");
    memoFilterStore.addFilter({ factor: "displayTime", value: date });
  };

  return (
    <div className="group w-full border mt-2 py-2 px-3 rounded-lg space-y-0.5 text-gray-500 dark:text-gray-400 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="w-full mb-1 flex flex-row justify-between items-center gap-1">
        <div className="relative text-sm font-medium inline-flex flex-row items-center w-auto dark:text-gray-400 truncate">
          <CalendarDaysIcon className="w-4 h-auto mr-1 opacity-60 shrink-0" strokeWidth={1.5} />
          <span className="truncate">
            {dayjs(visibleMonthString).toDate().toLocaleString(i18n.language, { year: "numeric", month: "long" })}
          </span>
        </div>
        <div className="flex justify-end items-center shrink-0">
          <span
            className="cursor-pointer hover:opacity-80"
            onClick={() => setVisibleMonthString(dayjs(visibleMonthString).subtract(1, "month").format("YYYY-MM"))}
          >
            <ChevronLeftIcon className="w-4 h-auto shrink-0 opacity-60" />
          </span>
          <span
            className="cursor-pointer hover:opacity-80"
            onClick={() => setVisibleMonthString(dayjs(visibleMonthString).add(1, "month").format("YYYY-MM"))}
          >
            <ChevronRightIcon className="w-4 h-auto shrink-0 opacity-60" />
          </span>
        </div>
      </div>
      <div className="w-full">
        <ActivityCalendar
          month={visibleMonthString}
          selectedDate={selectedDate.toDateString()}
          data={activityStats}
          onClick={onCalendarClick}
        />
        {memoAmount === 0 ? (
          <p className="mt-1 w-full text-xs italic opacity-80">{t("memo.no-memos")}</p>
        ) : (
          <p className="mt-1 w-full text-xs italic opacity-80">
            <span>{memoAmount}</span> {singularOrPluralMemo} {t("common.in").toLowerCase()} <span>{days}</span> {singularOrPluralDay}
          </p>
        )}
      </div>
      <Divider className="!my-2 opacity-50" />
      <div className="w-full flex flex-row justify-start items-center gap-x-2 gap-y-1 flex-wrap">
        <div
          className={clsx("w-auto border dark:border-zinc-800 pl-1 pr-1.5 rounded-md flex justify-between items-center")}
          onClick={() => memoFilterStore.addFilter({ factor: "property.hasLink", value: "" })}
        >
          <div className="w-auto flex justify-start items-center mr-1">
            <LinkIcon className="w-4 h-auto mr-1" />
            <span className="block text-sm">{t("memo.links")}</span>
          </div>
          <span className="text-sm truncate">{memoTypeStats.linkCount}</span>
        </div>
        <div
          className={clsx("w-auto border dark:border-zinc-800 pl-1 pr-1.5 rounded-md flex justify-between items-center")}
          onClick={() => memoFilterStore.addFilter({ factor: "property.hasTaskList", value: "" })}
        >
          <div className="w-auto flex justify-start items-center mr-1">
            {memoTypeStats.undoCount > 0 ? <ListTodoIcon className="w-4 h-auto mr-1" /> : <CheckCircleIcon className="w-4 h-auto mr-1" />}
            <span className="block text-sm">{t("memo.to-do")}</span>
          </div>
          {memoTypeStats.undoCount > 0 ? (
            <Tooltip title={"Done / Total"} placement="top" arrow>
              <div className="text-sm flex flex-row items-start justify-center">
                <span className="truncate">{memoTypeStats.todoCount - memoTypeStats.undoCount}</span>
                <span className="font-mono opacity-50">/</span>
                <span className="truncate">{memoTypeStats.todoCount}</span>
              </div>
            </Tooltip>
          ) : (
            <span className="text-sm truncate">{memoTypeStats.todoCount}</span>
          )}
        </div>
        <div
          className={clsx("w-auto border dark:border-zinc-800 pl-1 pr-1.5 rounded-md flex justify-between items-center")}
          onClick={() => memoFilterStore.addFilter({ factor: "property.hasCode", value: "" })}
        >
          <div className="w-auto flex justify-start items-center mr-1">
            <Code2Icon className="w-4 h-auto mr-1" />
            <span className="block text-sm">{t("memo.code")}</span>
          </div>
          <span className="text-sm truncate">{memoTypeStats.codeCount}</span>
        </div>
      </div>
    </div>
  );
};

export default StatisticsView;
