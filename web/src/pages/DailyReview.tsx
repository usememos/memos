import { last } from "lodash-es";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useMemoStore, useUserStore } from "../store/module";
import { DAILY_TIMESTAMP, DEFAULT_MEMO_LIMIT } from "../helpers/consts";
import * as utils from "../helpers/utils";
import MobileHeader from "../components/MobileHeader";
import useToggle from "../hooks/useToggle";
import toImage from "../labs/html2image";
import showPreviewImageDialog from "../components/PreviewImageDialog";
import Icon from "../components/Icon";
import DatePicker from "../components/base/DatePicker";
import DailyMemo from "../components/DailyMemo";

const monthChineseStrArray = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const weekdayChineseStrArray = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DailyReview = () => {
  const { t } = useTranslation();
  const memoStore = useMemoStore();
  const memos = memoStore.state.memos;

  const userStore = useUserStore();
  const { localSetting } = userStore.state.user as User;
  const [currentDateStamp, setCurrentDateStamp] = useState(utils.getDateStampByDate(utils.getDateString(Date.now())));
  const [showDatePicker, toggleShowDatePicker] = useToggle(false);
  const memosElRef = useRef<HTMLDivElement>(null);
  const currentDate = new Date(currentDateStamp);
  const dailyMemos = memos
    .filter((m) => {
      const createdTimestamp = utils.getTimeStampByDate(m.createdTs);
      const currentDateStampWithOffset = currentDateStamp + utils.convertToMillis(localSetting);
      return (
        m.rowStatus === "NORMAL" &&
        createdTimestamp >= currentDateStampWithOffset &&
        createdTimestamp < currentDateStampWithOffset + DAILY_TIMESTAMP
      );
    })
    .sort((a, b) => utils.getTimeStampByDate(a.createdTs) - utils.getTimeStampByDate(b.createdTs));

  useEffect(() => {
    const fetchMoreMemos = async () => {
      try {
        const fetchedMemos = await memoStore.fetchMemos();
        if (fetchedMemos.length === DEFAULT_MEMO_LIMIT) {
          const lastMemo = last(fetchedMemos);
          if (lastMemo && lastMemo.createdTs > currentDateStamp) {
            await fetchMoreMemos();
          }
        }
      } catch (error: any) {
        console.error(error);
        toast.error(error.response.data.message);
      }
    };
    fetchMoreMemos();
  }, [currentDateStamp]);

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
    <section className="w-full max-w-2xl min-h-full flex flex-col justify-start items-center px-4 sm:px-2 sm:pt-4 pb-8 bg-zinc-100 dark:bg-zinc-800">
      <MobileHeader showSearch={false} />
      <div className="w-full flex flex-col justify-start items-start px-4 py-3 rounded-xl bg-white dark:bg-zinc-700 text-black dark:text-gray-300">
        <div className="relative w-full flex flex-row justify-between items-center">
          <p
            className="px-2 py-1 flex flex-row justify-start items-center cursor-pointer select-none rounded hover:bg-gray-100 dark:hover:bg-zinc-700"
            onClick={() => toggleShowDatePicker()}
          >
            <Icon.Calendar className="w-5 h-auto mr-1" /> {t("common.daily-review")}
          </p>
          <div className="flex flex-row justify-end items-center">
            <button
              className="w-7 h-7 mr-2 flex justify-center items-center rounded cursor-pointer select-none last:mr-0 hover:bg-gray-200 dark:hover:bg-zinc-700 p-0.5"
              onClick={() => setCurrentDateStamp(currentDateStamp - DAILY_TIMESTAMP)}
            >
              <Icon.ChevronLeft className="w-full h-auto" />
            </button>
            <button
              className="w-7 h-7 mr-2 flex justify-center items-center rounded cursor-pointer select-none last:mr-0 hover:bg-gray-200 dark:hover:bg-zinc-700 p-0.5"
              onClick={() => setCurrentDateStamp(currentDateStamp + DAILY_TIMESTAMP)}
            >
              <Icon.ChevronRight className="w-full h-auto" />
            </button>
            <button
              className="w-7 h-7 mr-2 flex justify-center items-center rounded cursor-pointer select-none last:mr-0 hover:bg-gray-200 dark:hover:bg-zinc-700 p-0.5 share"
              onClick={handleShareBtnClick}
            >
              <Icon.Share2 size={16} />
            </button>
          </div>
          <DatePicker
            className={`absolute top-8 mt-2 z-20 mx-auto border bg-white dark:border-zinc-800 rounded-lg mb-6 ${
              showDatePicker ? "" : "!hidden"
            }`}
            datestamp={currentDateStamp}
            handleDateStampChange={handleDataPickerChange}
          />
        </div>
        <div
          className="w-full h-auto flex flex-col justify-start items-start px-2 sm:px-12 pt-14 pb-8 bg-white dark:bg-zinc-700"
          ref={memosElRef}
        >
          <div className="flex flex-col justify-center items-center mx-auto pb-10 select-none">
            <div className="mx-auto font-bold text-gray-600 dark:text-gray-300 text-center leading-6 mb-2">{currentDate.getFullYear()}</div>
            <div className="flex flex-col justify-center items-center m-auto w-24 h-24 shadow rounded-3xl dark:bg-zinc-800">
              <div className="text-center w-full leading-6 text-sm text-white bg-blue-700 rounded-t-3xl">
                {monthChineseStrArray[currentDate.getMonth()]}
              </div>
              <div className="text-black dark:text-white text-4xl font-medium leading-12">{currentDate.getDate()}</div>
              <div className="dark:text-gray-300 text-center w-full leading-6 -mt-2 text-xs">
                {weekdayChineseStrArray[currentDate.getDay()]}
              </div>
            </div>
          </div>
          {dailyMemos.length === 0 ? (
            <div className="mx-auto pt-4 pb-5 px-0">
              <p className="italic text-gray-400">{t("daily-review.oops-nothing")}</p>
            </div>
          ) : (
            <div className="flex flex-col justify-start items-start w-full mt-2">
              {dailyMemos.map((memo) => (
                <DailyMemo key={`${memo.id}-${memo.updatedTs}`} memo={memo} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default DailyReview;
