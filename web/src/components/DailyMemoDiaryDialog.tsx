import { useEffect, useRef, useState } from "react";
import { memoService } from "../services";
import toImage from "../labs/html2image";
import useToggle from "../hooks/useToggle";
import useLoading from "../hooks/useLoading";
import { DAILY_TIMESTAMP } from "../helpers/consts";
import utils from "../helpers/utils";
import { showDialog } from "./Dialog";
import showPreviewImageDialog from "./PreviewImageDialog";
import DailyMemo from "./DailyMemo";
import DatePicker from "./common/DatePicker";
import "../less/daily-memo-diary-dialog.less";

interface Props extends DialogProps {
  currentDateStamp: DateStamp;
}

const monthChineseStrArray = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
const weekdayChineseStrArray = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const DailyMemoDiaryDialog: React.FC<Props> = (props: Props) => {
  const loadingState = useLoading();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [currentDateStamp, setCurrentDateStamp] = useState(utils.getDateStampByDate(utils.getDateString(props.currentDateStamp)));
  const [showDatePicker, toggleShowDatePicker] = useToggle(false);
  const memosElRef = useRef<HTMLDivElement>(null);
  const currentDate = new Date(currentDateStamp);

  useEffect(() => {
    const setDailyMemos = () => {
      const dailyMemos = memoService
        .getState()
        .memos.filter(
          (a) =>
            utils.getTimeStampByDate(a.createdTs) >= currentDateStamp &&
            utils.getTimeStampByDate(a.createdTs) < currentDateStamp + DAILY_TIMESTAMP
        )
        .sort((a, b) => utils.getTimeStampByDate(a.createdTs) - utils.getTimeStampByDate(b.createdTs));
      setMemos(dailyMemos);
      loadingState.setFinish();
    };

    setDailyMemos();
  }, [currentDateStamp]);

  const handleShareBtnClick = () => {
    toggleShowDatePicker(false);

    setTimeout(() => {
      if (!memosElRef.current) {
        return;
      }

      toImage(memosElRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: window.devicePixelRatio * 2,
      })
        .then((url) => {
          showPreviewImageDialog(url);
        })
        .catch(() => {
          // do nth
        });
    }, 0);
  };

  const handleDataPickerChange = (datestamp: DateStamp): void => {
    setCurrentDateStamp(datestamp);
    toggleShowDatePicker(false);
  };

  return (
    <>
      <div className="dialog-header-container">
        <div className="header-wrapper">
          <p className="title-text">Daily Memos</p>
          <div className="btns-container">
            <span className="btn-text" onClick={() => setCurrentDateStamp(currentDateStamp - DAILY_TIMESTAMP)}>
              <img className="icon-img" src="/icons/arrow-left.svg" />
            </span>
            <span className="btn-text" onClick={() => setCurrentDateStamp(currentDateStamp + DAILY_TIMESTAMP)}>
              <img className="icon-img" src="/icons/arrow-right.svg" />
            </span>
            <span className="btn-text share-btn" onClick={handleShareBtnClick}>
              <img className="icon-img" src="/icons/share.svg" />
            </span>
            <span className="btn-text" onClick={() => props.destroy()}>
              <img className="icon-img" src="/icons/close.svg" />
            </span>
          </div>
        </div>
      </div>
      <div className="dialog-content-container" ref={memosElRef}>
        <div className="date-card-container" onClick={() => toggleShowDatePicker()}>
          <div className="year-text">{currentDate.getFullYear()}</div>
          <div className="date-container">
            <div className="month-text">{monthChineseStrArray[currentDate.getMonth()]}</div>
            <div className="date-text">{currentDate.getDate()}</div>
            <div className="day-text">{weekdayChineseStrArray[currentDate.getDay()]}</div>
          </div>
        </div>
        <DatePicker
          className={`date-picker ${showDatePicker ? "" : "hidden"}`}
          datestamp={currentDateStamp}
          handleDateStampChange={handleDataPickerChange}
        />
        {loadingState.isLoading ? (
          <div className="tip-container">
            <p className="tip-text">Loading...</p>
          </div>
        ) : memos.length === 0 ? (
          <div className="tip-container">
            <p className="tip-text">Oops, there is nothing.</p>
          </div>
        ) : (
          <div className="dailymemos-wrapper">
            {memos.map((memo) => (
              <DailyMemo key={`${memo.id}-${memo.updatedTs}`} memo={memo} />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default function showDailyMemoDiaryDialog(datestamp: DateStamp = Date.now()): void {
  showDialog(
    {
      className: "daily-memo-diary-dialog",
    },
    DailyMemoDiaryDialog,
    { currentDateStamp: datestamp }
  );
}
