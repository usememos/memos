import { Badge, Button } from "@mui/joy";
import classNames from "classnames";
import { useEffect, useState } from "react";
import { getMemoStats } from "@/helpers/api";
import { DAILY_TIMESTAMP } from "@/helpers/consts";
import { getDateStampByDate, isFutureDate } from "@/helpers/datetime";
import { useUserStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import Icon from "../Icon";
import "@/less/common/date-picker.less";

interface DatePickerProps {
  className?: string;
  isFutureDateDisabled?: boolean;
  datestamp: number;
  handleDateStampChange: (datestamp: number) => void;
}

const DatePicker: React.FC<DatePickerProps> = (props: DatePickerProps) => {
  const t = useTranslate();
  const { className, isFutureDateDisabled, datestamp, handleDateStampChange } = props;
  const [currentDateStamp, setCurrentDateStamp] = useState<number>(getMonthFirstDayDateStamp(datestamp));
  const [countByDate, setCountByDate] = useState(new Map());
  const currentUsername = useUserStore().getCurrentUsername();

  useEffect(() => {
    setCurrentDateStamp(getMonthFirstDayDateStamp(datestamp));
  }, [datestamp]);

  useEffect(() => {
    getMemoStats(currentUsername).then(({ data }) => {
      const m = new Map();
      for (const record of data) {
        const date = getDateStampByDate(record * 1000);
        m.set(date, true);
      }
      setCountByDate(m);
    });
  }, [currentUsername]);

  const firstDate = new Date(currentDateStamp);
  const firstDateDay = firstDate.getDay() === 0 ? 7 : firstDate.getDay();
  const dayList = [];
  for (let i = 1; i < firstDateDay; i++) {
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

  const handleChangeMonthBtnClick = (i: -1 | 1) => {
    const year = firstDate.getFullYear();
    const month = firstDate.getMonth() + 1;
    let nextDateStamp = 0;
    if (month === 1 && i === -1) {
      nextDateStamp = new Date(`${year - 1}/12/1`).getTime();
    } else if (month === 12 && i === 1) {
      nextDateStamp = new Date(`${year + 1}/1/1`).getTime();
    } else {
      nextDateStamp = new Date(`${year}/${month + i}/1`).getTime();
    }
    setCurrentDateStamp(getMonthFirstDayDateStamp(nextDateStamp));
  };

  return (
    <div className={`date-picker-wrapper ${className}`}>
      <div className="date-picker-header">
        <Button variant="plain" color="neutral" onClick={() => handleChangeMonthBtnClick(-1)}>
          <Icon.ChevronLeft className="icon-img" />
        </Button>
        <span className="normal-text">
          {firstDate.getFullYear()}/{firstDate.getMonth() + 1}
        </span>
        <Button variant="plain" color="neutral" onClick={() => handleChangeMonthBtnClick(1)}>
          <Icon.ChevronRight className="icon-img" />
        </Button>
      </div>
      <div className="date-picker-day-container">
        <div className="date-picker-day-header">
          <span className="day-item">{t("days.mon")}</span>
          <span className="day-item">{t("days.tue")}</span>
          <span className="day-item">{t("days.wed")}</span>
          <span className="day-item">{t("days.thu")}</span>
          <span className="day-item">{t("days.fri")}</span>
          <span className="day-item">{t("days.sat")}</span>
          <span className="day-item">{t("days.sun")}</span>
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
