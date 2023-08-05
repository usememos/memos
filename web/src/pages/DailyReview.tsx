import classNames from "classnames";
import { last } from "lodash-es";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import DailyMemo from "@/components/DailyMemo";
import Empty from "@/components/Empty";
import Icon from "@/components/Icon";
import MobileHeader from "@/components/MobileHeader";
import showPreviewImageDialog from "@/components/PreviewImageDialog";
import DatePicker from "@/components/kit/DatePicker";
import { DAILY_TIMESTAMP, DEFAULT_MEMO_LIMIT } from "@/helpers/consts";
import { convertToMillis, getDateStampByDate, getNormalizedDateString, getTimeStampByDate, isFutureDate } from "@/helpers/datetime";
import useToggle from "@/hooks/useToggle";
import i18n from "@/i18n";
import toImage from "@/labs/html2image";
import { useMemoStore, useUserStore } from "@/store/module";
import { findNearestLanguageMatch, useTranslate } from "@/utils/i18n";

const DailyReview = () => {
  const t = useTranslate();
  const memoStore = useMemoStore();
  const memos = memoStore.state.memos;

  const userStore = useUserStore();
  const { localSetting } = userStore.state.user as User;
  const [currentDateStamp, setCurrentDateStamp] = useState(getDateStampByDate(getNormalizedDateString()));
  const [showDatePicker, toggleShowDatePicker] = useToggle(false);
  const memosElRef = useRef<HTMLDivElement>(null);
  const currentDate = new Date(currentDateStamp);
  const dailyMemos = memos
    .filter((m) => {
      const displayTimestamp = getTimeStampByDate(m.displayTs);
      const currentDateStampWithOffset = currentDateStamp + convertToMillis(localSetting);
      return (
        m.rowStatus === "NORMAL" &&
        displayTimestamp >= currentDateStampWithOffset &&
        displayTimestamp < currentDateStampWithOffset + DAILY_TIMESTAMP
      );
    })
    .sort((a, b) => getTimeStampByDate(a.displayTs) - getTimeStampByDate(b.displayTs));

  useEffect(() => {
    let offset = 0;
    const fetchMoreMemos = async () => {
      try {
        const fetchedMemos = await memoStore.fetchMemos(DEFAULT_MEMO_LIMIT, offset);
        offset += fetchedMemos.length;
        if (fetchedMemos.length === DEFAULT_MEMO_LIMIT) {
          const lastMemo = last(fetchedMemos);
          if (lastMemo && lastMemo.displayTs > currentDateStamp) {
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

  const locale = findNearestLanguageMatch(i18n.language);
  const currentMonth = currentDate.toLocaleDateString(locale, { month: "short" });
  const currentDayOfWeek = currentDate.toLocaleDateString(locale, { weekday: "short" });
  const isFutureDateDisabled = isFutureDate(currentDateStamp + DAILY_TIMESTAMP);

  return (
    <section className="w-full max-w-3xl min-h-full flex flex-col justify-start items-center px-4 sm:px-2 sm:pt-4 pb-8 bg-zinc-100 dark:bg-zinc-800">
      <MobileHeader showSearch={false} />
      <div className="w-full flex flex-col justify-start items-start px-4 py-3 rounded-xl bg-white dark:bg-zinc-700 text-black dark:text-gray-300">
        <div className="relative w-full flex flex-row justify-between items-center">
          <p
            className="px-2 py-1 flex flex-row justify-start items-center cursor-pointer select-none rounded hover:bg-gray-100 dark:hover:bg-zinc-700"
            onClick={() => toggleShowDatePicker()}
          >
            <Icon.Calendar className="w-5 h-auto mr-1" /> {t("daily-review.title")}
          </p>
          <div className="flex flex-row justify-end items-center">
            <button
              className="w-7 h-7 mr-2 flex justify-center items-center rounded cursor-pointer select-none last:mr-0 hover:bg-gray-200 dark:hover:bg-zinc-700 p-0.5"
              onClick={() => setCurrentDateStamp(currentDateStamp - DAILY_TIMESTAMP)}
            >
              <Icon.ChevronLeft className="w-full h-auto" />
            </button>
            <button
              className={classNames(
                "w-7 h-7 mr-2 flex justify-center items-center rounded select-none last:mr-0 hover:bg-gray-200 dark:hover:bg-zinc-700 p-0.5",
                isFutureDateDisabled ? "cursor-not-allowed" : "cursor-pointer"
              )}
              onClick={() => setCurrentDateStamp(currentDateStamp + DAILY_TIMESTAMP)}
              disabled={isFutureDateDisabled}
            >
              <Icon.ChevronRight className="w-full h-auto" />
            </button>
            <button
              className="w-7 h-7 mr-2 flex justify-center items-center rounded cursor-pointer select-none last:mr-0 hover:bg-gray-200 dark:hover:bg-zinc-700 p-0.5 share"
              onClick={handleShareBtnClick}
            >
              <Icon.Share size={20} />
            </button>
          </div>
          <DatePicker
            className={`absolute top-8 mt-2 z-20 mx-auto border bg-white shadow dark:bg-zinc-800 dark:border-zinc-800 rounded-lg mb-6 ${
              showDatePicker ? "" : "!hidden"
            }`}
            datestamp={currentDateStamp}
            handleDateStampChange={handleDataPickerChange}
            isFutureDateDisabled
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
                {currentMonth[0].toUpperCase() + currentMonth.substring(1)}
              </div>
              <div className="text-black dark:text-white text-4xl font-medium leading-12">{currentDate.getDate()}</div>
              <div className="dark:text-gray-300 text-center w-full leading-6 -mt-2 text-xs">
                {currentDayOfWeek[0].toUpperCase() + currentDayOfWeek.substring(1)}
              </div>
            </div>
          </div>
          {dailyMemos.length === 0 ? (
            <div className="w-full mt-4 mb-8 flex flex-col justify-center items-center italic">
              <Empty />
              <p className="mt-4 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
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
