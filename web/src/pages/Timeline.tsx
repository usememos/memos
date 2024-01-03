import { Button } from "@mui/joy";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import useToggle from "react-use/lib/useToggle";
import Empty from "@/components/Empty";
import Icon from "@/components/Icon";
import MemoEditor from "@/components/MemoEditor";
import MobileHeader from "@/components/MobileHeader";
import TimelineMemo from "@/components/TimelineMemo";
import DatePicker from "@/components/kit/DatePicker";
import { DAILY_TIMESTAMP } from "@/helpers/consts";
import { getDateStampByDate, getNormalizedDateString, getTimeStampByDate } from "@/helpers/datetime";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoList, useMemoStore } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";

const Timeline = () => {
  const t = useTranslate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useCurrentUser();
  const memoStore = useMemoStore();
  const memoList = useMemoList();
  const currentDateStamp = getDateStampByDate(getNormalizedDateString()) as number;
  const [selectedDateStamp, setSelectedDateStamp] = useState<number>(
    (searchParams.get("timestamp") ? Number(searchParams.get("timestamp")) : currentDateStamp) as number
  );
  const [isRequesting, setIsRequesting] = useState(true);
  const [showDatePicker, toggleShowDatePicker] = useToggle(false);
  const sortedMemos = memoList.value.sort((a, b) => getTimeStampByDate(a.createTime) - getTimeStampByDate(b.createTime));

  useEffect(() => {
    setSearchParams();
  }, []);

  useEffect(() => {
    memoList.reset();
    fetchMemos();
  }, [selectedDateStamp]);

  const fetchMemos = async () => {
    const filters = [
      `creator == "${user.name}"`,
      `row_status == "NORMAL"`,
      `created_ts_after == ${selectedDateStamp / 1000}`,
      `created_ts_before == ${(selectedDateStamp + DAILY_TIMESTAMP) / 1000}`,
    ];
    setIsRequesting(true);
    await memoStore.fetchMemos({
      filter: filters.join(" && "),
      offset: memoList.size(),
    });
    setIsRequesting(false);
  };

  const handleDataPickerChange = (datestamp: number): void => {
    setSelectedDateStamp(datestamp);
    toggleShowDatePicker(false);
  };

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      <MobileHeader />
      <div className="w-full px-4 sm:px-6">
        <div className="w-full shadow flex flex-col justify-start items-start px-4 py-3 rounded-xl bg-white dark:bg-zinc-800 text-black dark:text-gray-300">
          <div className="relative w-full flex flex-row justify-start items-center">
            <p
              className="px-2 py-1 mr-2 flex flex-row justify-start items-center cursor-pointer select-none rounded opacity-80 hover:bg-gray-100 dark:hover:bg-zinc-700"
              onClick={() => toggleShowDatePicker()}
            >
              <Icon.Calendar className="w-5 h-auto mr-2" />
              <span className="font-mono mt-0.5">{new Date(selectedDateStamp).toLocaleDateString()}</span>
            </p>
            {selectedDateStamp !== currentDateStamp && (
              <Button
                variant="outlined"
                startDecorator={<Icon.Undo2 className="w-5 h-auto" />}
                onClick={() => setSelectedDateStamp(currentDateStamp)}
              >
                {"Back to today"}
              </Button>
            )}
            <DatePicker
              className={`absolute top-8 mt-2 z-20 mx-auto border bg-white shadow dark:bg-zinc-800 dark:border-zinc-800 rounded-lg mb-6 ${
                showDatePicker ? "" : "!hidden"
              }`}
              datestamp={selectedDateStamp}
              isFutureDateDisabled
              handleDateStampChange={handleDataPickerChange}
              handleClickAway={() => toggleShowDatePicker(false)}
            />
          </div>
          <div className="w-full h-auto flex flex-col justify-start items-start px-2 pb-4 bg-white dark:bg-zinc-800">
            <div className="flex flex-col justify-start items-start w-full mt-2">
              {sortedMemos.map((memo, index) => (
                <div
                  key={`${memo.id}-${memo.createTime}`}
                  className="relative w-full flex flex-col justify-start items-start pl-8 sm:pl-12 pt-2 pb-4"
                >
                  <TimelineMemo memo={memo} />
                  <div className="absolute left-1 sm:left-2 top-3 h-full">
                    {index !== sortedMemos.length - 1 && (
                      <div className="absolute top-2 left-[7px] h-full w-0.5 bg-gray-400 dark:bg-gray-500 block"></div>
                    )}
                    <div className="border-4 rounded-full border-white relative dark:border-zinc-800">
                      <Icon.Circle className="w-2 h-auto bg-gray-400 text-gray-400 dark:bg-gray-500 dark:text-gray-500 rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
              {!isRequesting && sortedMemos.length === 0 && (
                <div className="w-full mt-4 mb-8 flex flex-col justify-center items-center italic">
                  <Empty />
                  <p className="mt-4 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
                </div>
              )}
              {selectedDateStamp === currentDateStamp && (
                <div className="w-full pl-0 sm:pl-12 sm:mt-4">
                  <MemoEditor cacheKey="timeline-editor" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Timeline;
