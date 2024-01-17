import { Tooltip } from "@mui/joy";
import classNames from "classnames";

interface Props {
  // Format: 2021-1
  month: string;
  data: Record<string, number>;
}

const getBgColor = (count: number, maxCount: number) => {
  if (count === 0) {
    return "bg-gray-100 dark:bg-gray-700";
  }

  const ratio = count / maxCount;
  if (ratio > 0.7) {
    return "bg-blue-600";
  } else if (ratio > 0.5) {
    return "bg-blue-400";
  } else if (ratio > 0.3) {
    return "bg-blue-300";
  } else {
    return "bg-blue-200";
  }
};

const ActivityCalendar = (props: Props) => {
  const { month: monthStr, data } = props;
  const [year, month] = monthStr.split("-");
  const dayInMonth = new Date(Number(year), Number(month), 0).getDate();
  const firstDay = new Date(Number(year), Number(month) - 1, 1).getDay();
  const lastDay = new Date(Number(year), Number(month) - 1, dayInMonth).getDay();
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
    <div className="w-28 h-20 p-0.5 shrink-0 grid grid-cols-7 grid-flow-row gap-1">
      {days.map((day, index) => {
        const date = `${year}-${month}-${day}`;
        const count = data[date] || 0;
        return day ? (
          <Tooltip className="shrink-0" key={`${date}-${index}`} title={`${count} memos in ${date}`} placement="top">
            <div className={classNames("w-3 h-3 rounded flex justify-center items-center", getBgColor(count, maxCount))}></div>
          </Tooltip>
        ) : (
          <div
            key={`${date}-${index}`}
            className={classNames("shrink-0 opacity-30 w-3 h-3 rounded flex justify-center items-center", getBgColor(count, maxCount))}
          ></div>
        );
      })}
    </div>
  );
};

export default ActivityCalendar;
