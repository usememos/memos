import { Badge, Button } from "@mui/joy";
import classNames from "classnames";
import { useEffect, useRef, useState } from "react";
import useClickAway from "react-use/lib/useClickAway";
import { memoServiceClient } from "@/grpcweb";
import { DAILY_TIMESTAMP } from "@/helpers/consts";
import { getDateStampByDate, getTimeStampByDate, isFutureDate } from "@/helpers/datetime";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useTranslate } from "@/utils/i18n";
import Icon from "../Icon";
import "@/less/common/date-picker.less";

interface DatePickerProps {
  className?: string;
  isFutureDateDisabled?: boolean;
  datestamp: number;
  handleDateStampChange: (datestamp: number) => void;
  handleClickAway: () => void;
}

const DatePicker: React.FC<DatePickerProps> = (props: DatePickerProps) => {
  const t = useTranslate();
  const { className, isFutureDateDisabled, datestamp, handleDateStampChange, handleClickAway } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentDateStamp, setCurrentDateStamp] = useState<number>(getMonthFirstDayDateStamp(datestamp));
  const [countByDate, setCountByDate] = useState(new Map());
  const user = useCurrentUser();

  useClickAway(containerRef, () => {
    handleClickAway();
  });

  useEffect(() => {
    setCurrentDateStamp(getMonthFirstDayDateStamp(datestamp));
  }, [datestamp]);

  useEffect(() => {
    (async () => {
      const { stats } = await memoServiceClient.getUserMemosStats({
        name: user.name,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      const m = new Map();
      Object.entries(stats).forEach(([k]) => {
        const utcOffsetMilliseconds = new Date().getTimezoneOffset() * 60 * 1000;
        const date = getDateStampByDate(new Date(getTimeStampByDate(k) + utcOffsetMilliseconds));
        m.set(date, true);
      });
      setCountByDate(m);
    })();
  }, [user.name]);

  const firstDate = new Date(currentDateStamp);
  const dayList = [];
  for (let i = 0; i < firstDate.getDay(); i++) {
    dayList.push({
      date: 0,
      datestamp: firstDate.getTime() - DAILY_TIMESTAMP * (7 - i),
    });
  }
  const dayAmount = getMonthDayAmount(currentDateStamp);
  for (let i = 1; i <= dayAmount; i++) {
    dayList.push({
      date: i,
      datestamp: firstDate.getTime() + DAILY_TIMESTAMP * (i - 1),
    });
  }

  const handleDateItemClick = (datestamp: number) => {
    handleDateStampChange(datestamp);
  };

  const handleChangeMonthBtnClick = (i: number) => {
    const nextDate = new Date(firstDate.getTime());
    nextDate.setMonth(nextDate.getMonth() + i);
    setCurrentDateStamp(getMonthFirstDayDateStamp(nextDate.getTime()));
  };

  return (
    <div ref={containerRef} className={`date-picker-wrapper ${className}`}>
      <div className="date-picker-header">
        <Button variant="plain" color="neutral" onClick={() => handleChangeMonthBtnClick(-12)}>
          <Icon.ChevronsLeft className="icon-img" />
        </Button>
        <Button variant="plain" color="neutral" onClick={() => handleChangeMonthBtnClick(-1)}>
          <Icon.ChevronLeft className="icon-img" />
        </Button>
        <span className="normal-text">
          {firstDate.getFullYear()}/{(firstDate.getMonth() + 1).toString().padStart(2, "0")}
        </span>
        <Button variant="plain" color="neutral" onClick={() => handleChangeMonthBtnClick(1)}>
          <Icon.ChevronRight className="icon-img" />
        </Button>
        <Button variant="plain" color="neutral" onClick={() => handleChangeMonthBtnClick(12)}>
          <Icon.ChevronsRight className="icon-img" />
        </Button>
      </div>
      <div className="date-picker-day-container">
        <div className="date-picker-day-header">
          <span className="day-item">{t("days.sun")}</span>
          <span className="day-item">{t("days.mon")}</span>
          <span className="day-item">{t("days.tue")}</span>
          <span className="day-item">{t("days.wed")}</span>
          <span className="day-item">{t("days.thu")}</span>
          <span className="day-item">{t("days.fri")}</span>
          <span className="day-item">{t("days.sat")}</span>
        </div>

        {dayList.map((d) => {
          const isDisabled = isFutureDateDisabled && isFutureDate(d.datestamp);
          if (d.date === 0) {
            return (
              <span key={d.datestamp} className="day-item null">
                {""}
              </span>
            );
          } else {
            return (
              <span
                key={d.datestamp}
                className={classNames(`day-item relative ${d.datestamp === datestamp ? "current" : ""}`, isDisabled && "disabled")}
                onClick={() => (isDisabled ? null : handleDateItemClick(d.datestamp))}
              >
                {countByDate.has(d.datestamp) ? <Badge size="sm">{d.date}</Badge> : d.date}
              </span>
            );
          }
        })}
      </div>
    </div>
  );
};

function getMonthDayAmount(datestamp: number): number {
  const dateTemp = new Date(datestamp);
  const currentDate = new Date(`${dateTemp.getFullYear()}/${dateTemp.getMonth() + 1}/1`);
  const nextMonthDate =
    currentDate.getMonth() === 11
      ? new Date(`${currentDate.getFullYear() + 1}/1/1`)
      : new Date(`${currentDate.getFullYear()}/${currentDate.getMonth() + 2}/1`);

  return (nextMonthDate.getTime() - currentDate.getTime()) / DAILY_TIMESTAMP;
}

function getMonthFirstDayDateStamp(timestamp: number): number {
  const dateTemp = new Date(timestamp);
  const currentDate = new Date(`${dateTemp.getFullYear()}/${dateTemp.getMonth() + 1}/1`);
  return currentDate.getTime();
}

export default DatePicker;
