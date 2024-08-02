import { Divider, Tooltip } from "@mui/joy";
import clsx from "clsx";
import dayjs from "dayjs";
import { countBy } from "lodash-es";
import { useState } from "react";
import toast from "react-hot-toast";
import { memoServiceClient } from "@/grpcweb";
import useAsyncEffect from "@/hooks/useAsyncEffect";
import useCurrentUser from "@/hooks/useCurrentUser";
import i18n from "@/i18n";
import { useMemoFilterStore, useMemoStore } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";
import ActivityCalendar from "./ActivityCalendar";
import Icon from "./Icon";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/Popover";

interface UserMemoStats {
  link: number;
  taskList: number;
  code: number;
  incompleteTasks: number;
}

const UserStatisticsView = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const memoStore = useMemoStore();
  const memoFilterStore = useMemoFilterStore();
  const [memoAmount, setMemoAmount] = useState(0);
  const [memoStats, setMemoStats] = useState<UserMemoStats>({ link: 0, taskList: 0, code: 0, incompleteTasks: 0 });
  const [activityStats, setActivityStats] = useState<Record<string, number>>({});
  const [selectedDate] = useState(new Date());
  const [monthString, setMonthString] = useState(dayjs(selectedDate.toDateString()).format("YYYY-MM"));
  const days = Math.ceil((Date.now() - currentUser.createTime!.getTime()) / 86400000);

  useAsyncEffect(async () => {
    const { entities } = await memoServiceClient.listMemoProperties({
      name: `memos/-`,
    });
    const memoStats: UserMemoStats = { link: 0, taskList: 0, code: 0, incompleteTasks: 0 };
    entities.forEach((entity) => {
      const { property } = entity;
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
    setMemoAmount(entities.length);
    setActivityStats(countBy(entities.map((entity) => dayjs(entity.displayTime).format("YYYY-MM-DD"))));
  }, [memoStore.stateId]);

  const rebuildMemoTags = async () => {
    await memoServiceClient.rebuildMemoProperty({
      name: "memos/-",
    });
    toast.success("Refresh successfully");
    window.location.reload();
  };

  const onCalendarClick = (date: string) => {
    memoFilterStore.removeFilter((f) => f.factor === "displayTime");
    memoFilterStore.addFilter({ factor: "displayTime", value: date });
  };

  return (
    <div className="group w-full border mt-2 py-2 px-3 rounded-lg space-y-0.5 text-gray-500 dark:text-gray-400 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="w-full mb-1 flex flex-row justify-between items-center">
        <div className="relative text-base font-medium leading-6 flex flex-row items-center dark:text-gray-400">
          <Icon.CalendarDays className="w-5 h-auto mr-1 opacity-60" strokeWidth={1.5} />
          <span>{dayjs(monthString).toDate().toLocaleString(i18n.language, { year: "numeric", month: "long" })}</span>
          <input
            className="inset-0 absolute z-1 opacity-0"
            type="month"
            value={monthString}
            onFocus={(e: any) => e.target.showPicker()}
            onChange={(e) => setMonthString(e.target.value || dayjs().format("YYYY-MM"))}
          />
        </div>
        <div className="invisible group-hover:visible flex justify-end items-center">
          <Popover>
            <PopoverTrigger>
              <Icon.MoreVertical className="w-4 h-auto shrink-0 opacity-60" />
            </PopoverTrigger>
            <PopoverContent align="end" alignOffset={-12}>
              <button className="w-auto flex flex-row justify-between items-center gap-2 hover:opacity-80" onClick={rebuildMemoTags}>
                <Icon.RefreshCcw className="text-gray-400 w-4 h-auto cursor-pointer opacity-60" />
                <span className="text-sm shrink-0 text-gray-500 dark:text-gray-400">Refresh</span>
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="w-full">
        <ActivityCalendar month={monthString} selectedDate={selectedDate.toDateString()} data={activityStats} onClick={onCalendarClick} />
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
            <Icon.Link className="w-4 h-auto mr-1" />
            <span className="block text-sm">{t("memo.links")}</span>
          </div>
          <span className="text-sm truncate">{memoStats.link}</span>
        </div>
        <div
          className={clsx("w-auto border dark:border-zinc-800 pl-1 pr-1.5 rounded-md flex justify-between items-center")}
          onClick={() => memoFilterStore.addFilter({ factor: "property.hasTaskList", value: "" })}
        >
          <div className="w-auto flex justify-start items-center mr-1">
            {memoStats.incompleteTasks > 0 ? (
              <Icon.ListTodo className="w-4 h-auto mr-1" />
            ) : (
              <Icon.CheckCircle className="w-4 h-auto mr-1" />
            )}
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
            <Icon.Code2 className="w-4 h-auto mr-1" />
            <span className="block text-sm">{t("memo.code")}</span>
          </div>
          <span className="text-sm truncate">{memoStats.code}</span>
        </div>
      </div>
    </div>
  );
};

export default UserStatisticsView;
