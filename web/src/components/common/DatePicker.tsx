import { useEffect, useState } from "react";
import { DAILY_TIMESTAMP } from "../../helpers/consts";
import "../../less/common/date-picker.less";

interface DatePickerProps {
  className?: string;
  datestamp: DateStamp;
  handleDateStampChange: (datastamp: DateStamp) => void;
}

const DatePicker: React.FC<DatePickerProps> = (props: DatePickerProps) => {
  const { className, datestamp, handleDateStampChange } = props;
  const [currentDateStamp, setCurrentDateStamp] = useState<DateStamp>(getMonthFirstDayDateStamp(datestamp));

  useEffect(() => {
    setCurrentDateStamp(getMonthFirstDayDateStamp(datestamp));
  }, [datestamp]);

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

  const handleDateItemClick = (datestamp: DateStamp) => {
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
        <span className="btn-text" onClick={() => handleChangeMonthBtnClick(-1)}>
          <img className="icon-img" src="/icons/arrow-left.svg" />
        </span>
        <span className="normal-text">
          {firstDate.getFullYear()} 年 {firstDate.getMonth() + 1} 月
        </span>
        <span className="btn-text" onClick={() => handleChangeMonthBtnClick(1)}>
          <img className="icon-img" src="/icons/arrow-right.svg" />
        </span>
      </div>
      <div className="date-picker-day-container">
        <div className="date-picker-day-header">
          <span className="day-item">周一</span>
          <span className="day-item">周二</span>
          <span className="day-item">周三</span>
          <span className="day-item">周四</span>
          <span className="day-item">周五</span>
          <span className="day-item">周六</span>
          <span className="day-item">周日</span>
        </div>

        {dayList.map((d) => {
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
                className={`day-item ${d.datestamp === datestamp ? "current" : ""}`}
                onClick={() => handleDateItemClick(d.datestamp)}
              >
                {d.date}
              </span>
            );
          }
        })}
      </div>
    </div>
  );
};

function getMonthDayAmount(datestamp: DateStamp): number {
  const dateTemp = new Date(datestamp);
  const currentDate = new Date(`${dateTemp.getFullYear()}/${dateTemp.getMonth() + 1}/1`);
  const nextMonthDate =
    currentDate.getMonth() === 11
      ? new Date(`${currentDate.getFullYear() + 1}/1/1`)
      : new Date(`${currentDate.getFullYear()}/${currentDate.getMonth() + 2}/1`);

  return (nextMonthDate.getTime() - currentDate.getTime()) / DAILY_TIMESTAMP;
}

function getMonthFirstDayDateStamp(timestamp: TimeStamp): DateStamp {
  const dateTemp = new Date(timestamp);
  const currentDate = new Date(`${dateTemp.getFullYear()}/${dateTemp.getMonth() + 1}/1`);
  return currentDate.getTime();
}

export default DatePicker;
