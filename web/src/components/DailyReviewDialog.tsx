import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMemoStore } from "../store/module";
import toImage from "../labs/html2image";
import useToggle from "../hooks/useToggle";
import { DAILY_TIMESTAMP } from "../helpers/consts";
import * as utils from "../helpers/utils";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import DatePicker from "./common/DatePicker";
import showPreviewImageDialog from "./PreviewImageDialog";
import DailyMemo from "./DailyMemo";
import "../less/daily-review-dialog.less";

interface Props extends DialogProps {
  currentDateStamp: DateStamp;
}

const monthChineseStrArray = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const weekdayChineseStrArray = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DailyReviewDialog: React.FC<Props> = (props: Props) => {
  const { t } = useTranslation();
  const memoStore = useMemoStore();
  const memos = memoStore.state.memos;
  const [currentDateStamp, setCurrentDateStamp] = useState(utils.getDateStampByDate(utils.getDateString(props.currentDateStamp)));
  const [showDatePicker, toggleShowDatePicker] = useToggle(false);
  const memosElRef = useRef<HTMLDivElement>(null);
  const currentDate = new Date(currentDateStamp);
  const dailyMemos = memos
    .filter(
      (m) =>
        m.rowStatus === "NORMAL" &&
        utils.getTimeStampByDate(m.createdTs) >= currentDateStamp &&
        utils.getTimeStampByDate(m.createdTs) < currentDateStamp + DAILY_TIMESTAMP
    )
    .sort((a, b) => utils.getTimeStampByDate(a.createdTs) - utils.getTimeStampByDate(b.createdTs));

  const handleShareBtnClick = () => {
    if (!memosElRef.current) {
      return;
    }

    toggleShowDatePicker(false);

    toImage(memosElRef.current, {
      pixelRatio: window.devicePixelRatio * 2,
    })
      .then((url) => {
        showPreviewImageDialog(url);
      })
      .catch(() => {
        // do nth
      });
  };

  const handleDataPickerChange = (datestamp: DateStamp): void => {
    setCurrentDateStamp(datestamp);
    toggleShowDatePicker(false);
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text" onClick={() => toggleShowDatePicker()}>
          <span className="icon-text">📅</span> {t("sidebar.daily-review")}
        </p>
        <div className="btns-container">
          <button className="btn-text" onClick={() => setCurrentDateStamp(currentDateStamp - DAILY_TIMESTAMP)}>
            <Icon.ChevronLeft className="icon-img" />
          </button>
          <button className="btn-text" onClick={() => setCurrentDateStamp(currentDateStamp + DAILY_TIMESTAMP)}>
            <Icon.ChevronRight className="icon-img" />
          </button>
          <button className="btn-text share" onClick={handleShareBtnClick}>
            <Icon.Share2 size={16} />
          </button>
          <span className="split-line">/</span>
          <button className="btn-text" onClick={() => props.destroy()}>
            <Icon.X className="icon-img" />
          </button>
        </div>
        <DatePicker
          className={`date-picker ${showDatePicker ? "" : "!hidden"}`}
          datestamp={currentDateStamp}
          handleDateStampChange={handleDataPickerChange}
        />
      </div>
      <div className="dialog-content-container" ref={memosElRef}>
        <div className="date-card-container">
          <div className="year-text">{currentDate.getFullYear()}</div>
          <div className="date-container">
            <div className="month-text">{monthChineseStrArray[currentDate.getMonth()]}</div>
            <div className="date-text">{currentDate.getDate()}</div>
            <div className="day-text">{weekdayChineseStrArray[currentDate.getDay()]}</div>
          </div>
        </div>
        {dailyMemos.length === 0 ? (
          <div className="tip-container">
            <p className="tip-text">{t("daily-review.oops-nothing")}</p>
          </div>
        ) : (
          <div className="dailymemos-wrapper">
            {dailyMemos.map((memo) => (
              <DailyMemo key={`${memo.id}-${memo.updatedTs}`} memo={memo} />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default function showDailyReviewDialog(datestamp: DateStamp = Date.now()): void {
  generateDialog(
    {
      className: "daily-review-dialog",
      dialogName: "daily-review-dialog",
    },
    DailyReviewDialog,
    { currentDateStamp: datestamp }
  );
}
