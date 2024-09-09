import { Tooltip } from "@mui/joy";
import clsx from "clsx";
import dayjs from "dayjs";
import { useWorkspaceSettingStore } from "@/store/v1";
import { WorkspaceGeneralSetting } from "@/types/proto/api/v1/workspace_setting_service";
import { WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";
import { useTranslate } from "@/utils/i18n";

interface Props {
  // Format: 2021-1
  month: string;
  selectedDate: string;
  data: Record<string, number>;
  onClick?: (date: string) => void;
}

const getCellAdditionalStyles = (count: number, maxCount: number) => {
  if (count === 0) {
    return "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500";
  }

  const ratio = count / maxCount;
  if (ratio > 0.7) {
    return "bg-teal-700 text-gray-100 dark:opacity-80";
  } else if (ratio > 0.4) {
    return "bg-teal-600 text-gray-100 dark:opacity-80";
  } else {
    return "bg-teal-500 text-gray-100 dark:opacity-70";
  }
};

const ActivityCalendar = (props: Props) => {
  const t = useTranslate();
  const { month: monthStr, data, onClick } = props;
  const workspaceSettingStore = useWorkspaceSettingStore();
  const weekStartDayOffset = (
    workspaceSettingStore.getWorkspaceSettingByKey(WorkspaceSettingKey.GENERAL).generalSetting || WorkspaceGeneralSetting.fromPartial({})
  ).weekStartDayOffset;
  const year = dayjs(monthStr).toDate().getFullYear();
  const month = dayjs(monthStr).toDate().getMonth() + 1;
  const dayInMonth = new Date(year, month, 0).getDate();
  const firstDay = (((new Date(year, month - 1, 1).getDay() - weekStartDayOffset) % 7) + 7) % 7;
  const lastDay = new Date(year, month - 1, dayInMonth).getDay() - weekStartDayOffset;
  const WEEK_DAYS = [t("days.sun"), t("days.mon"), t("days.tue"), t("days.wed"), t("days.thu"), t("days.fri"), t("days.sat")];
  const weekDays = WEEK_DAYS.slice(weekStartDayOffset).concat(WEEK_DAYS.slice(0, weekStartDayOffset));
  const maxCount = Math.max(...Object.values(data));
  const days = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(0);
  }
  for (let i = 1; i <= dayInMonth; i++) {
    days.push(i);
  }
  for (let i = 0; i < 6 - lastDay; i++) {
    days.push(0);
  }

  return (
    <div className={clsx("w-full h-auto shrink-0 grid grid-cols-7 grid-flow-row gap-1")}>
      {weekDays.map((day, index) => {
        return (
          <div key={index} className={clsx("w-6 h-5 text-xs flex justify-center items-center cursor-default opacity-60")}>
            {day}
          </div>
        );
      })}
      {days.map((day, index) => {
        const date = dayjs(`${year}-${month}-${day}`).format("YYYY-MM-DD");
        const count = data[date] || 0;
        const isToday = dayjs().format("YYYY-MM-DD") === date;
        const tooltipText = count ? t("memo.count-memos-in-date", { count: count, date: date }) : date;
        const isSelected = dayjs(props.selectedDate).format("YYYY-MM-DD") === date;
        return day ? (
          count > 0 ? (
            <Tooltip className="shrink-0" key={`${date}-${index}`} title={tooltipText} placement="top" arrow>
              <div
                className={clsx(
                  "w-6 h-6 text-xs rounded-xl flex justify-center items-center border cursor-default",
                  getCellAdditionalStyles(count, maxCount),
                  isToday && "border-zinc-400 dark:border-zinc-300",
                  isSelected && "font-bold border-zinc-400 dark:border-zinc-300",
                  !isToday && !isSelected && "border-transparent",
                )}
                onClick={() => count && onClick && onClick(date)}
              >
                {day}
              </div>
            </Tooltip>
          ) : (
            <div
              key={`${date}-${index}`}
              className={clsx(
                "w-6 h-6 text-xs rounded-xl flex justify-center items-center border cursor-default",
                "bg-gray-100 text-gray-400 dark:bg-zinc-800 dark:text-gray-500",
                isToday && "border-zinc-400 dark:border-zinc-500",
                !isToday && !isSelected && "border-transparent",
              )}
            >
              {day}
            </div>
          )
        ) : (
          <div key={`${date}-${index}`} className="shrink-0 w-6 h-6 opacity-0"></div>
        );
      })}
    </div>
  );
};

export default ActivityCalendar;
