import { Divider, Tooltip } from "@mui/joy";
import clsx from "clsx";
import dayjs from "dayjs";
import { countBy } from "lodash-es";
import { CalendarDaysIcon, CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, Code2Icon, LinkIcon, ListTodoIcon } from "lucide-react";
import { useState } from "react";
import useAsyncEffect from "@/hooks/useAsyncEffect";
import useCurrentUser from "@/hooks/useCurrentUser";
import i18n from "@/i18n";
import { useMemoFilterStore, useMemoMetadataStore } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";
import ActivityCalendar from "./ActivityCalendar";

interface UserMemoStats {
  link: number;
  taskList: number;
  code: number;
  incompleteTasks: number;
}

const UserStatisticsView = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const memoFilterStore = useMemoFilterStore();
  const memoMetadataStore = useMemoMetadataStore();
  const metadataList = Object.values(memoMetadataStore.getState().dataMapByName);
  const [memoAmount, setMemoAmount] = useState(0);
  const [memoStats, setMemoStats] = useState<UserMemoStats>({ link: 0, taskList: 0, code: 0, incompleteTasks: 0 });
  const [activityStats, setActivityStats] = useState<Record<string, number>>({});
  const [selectedDate] = useState(new Date());
  const [visibleMonthString, setVisibleMonthString] = useState(dayjs(selectedDate.toDateString()).format("YYYY-MM"));
  const days = Math.ceil((Date.now() - currentUser.createTime!.getTime()) / 86400000);

  useAsyncEffect(async () => {
    const memoStats: UserMemoStats = { link: 0, taskList: 0, code: 0, incompleteTasks: 0 };
    metadataList.forEach((memo) => {
      const { property } = memo;
      if (property?.hasLink) {
        memoStats.link += 1;
      }
      if (property?.hasTaskList) {
        memoStats.taskList += 1;
      }
      if (property?.hasCode) {
        memoStats.code += 1;
      }
      if (property?.hasIncompleteTasks) {
        memoStats.incompleteTasks += 1;
      }
    });
    setMemoStats(memoStats);
    setMemoAmount(metadataList.length);
    setActivityStats(countBy(metadataList.map((memo) => dayjs(memo.displayTime).format("YYYY-MM-DD"))));
  }, [memoMetadataStore.stateId]);

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
        {memoAmount > 0 && (
          <p className="mt-1 w-full text-xs italic opacity-80">
            <span>{memoAmount}</span> memos in <span>{days}</span> {days > 1 ? "days" : "day"}
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
          <span className="text-sm truncate">{memoStats.link}</span>
        </div>
        <div
          className={clsx("w-auto border dark:border-zinc-800 pl-1 pr-1.5 rounded-md flex justify-between items-center")}
          onClick={() => memoFilterStore.addFilter({ factor: "property.hasTaskList", value: "" })}
        >
          <div className="w-auto flex justify-start items-center mr-1">
            {memoStats.incompleteTasks > 0 ? <ListTodoIcon className="w-4 h-auto mr-1" /> : <CheckCircleIcon className="w-4 h-auto mr-1" />}
            <span className="block text-sm">{t("memo.to-do")}</span>
          </div>
          {memoStats.incompleteTasks > 0 ? (
            <Tooltip title={"Done / Total"} placement="top" arrow>
              <div className="text-sm flex flex-row items-start justify-center">
                <span className="truncate">{memoStats.taskList - memoStats.incompleteTasks}</span>
                <span className="font-mono opacity-50">/</span>
                <span className="truncate">{memoStats.taskList}</span>
              </div>
            </Tooltip>
          ) : (
            <span className="text-sm truncate">{memoStats.taskList}</span>
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
          <span className="text-sm truncate">{memoStats.code}</span>
        </div>
      </div>
    </div>
  );
};

export default UserStatisticsView;
