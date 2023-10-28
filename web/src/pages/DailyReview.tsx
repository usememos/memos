import { Button } from "@mui/joy";
import { last } from "lodash-es";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import useToggle from "react-use/lib/useToggle";
import Empty from "@/components/Empty";
import Icon from "@/components/Icon";
import MemoContent from "@/components/MemoContent";
import MemoEditor from "@/components/MemoEditor";
import MemoRelationListView from "@/components/MemoRelationListView";
import MemoResourceListView from "@/components/MemoResourceListView";
import MobileHeader from "@/components/MobileHeader";
import DatePicker from "@/components/kit/DatePicker";
import { DAILY_TIMESTAMP, DEFAULT_MEMO_LIMIT } from "@/helpers/consts";
import { getDateStampByDate, getNormalizedDateString, getTimeStampByDate, getTimeString } from "@/helpers/datetime";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoStore, useUserStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";

const DailyReview = () => {
  const t = useTranslate();
  const memoStore = useMemoStore();
  const userStore = useUserStore();
  const user = useCurrentUser();
  const { localSetting } = userStore.state.user as User;
  const currentDateStamp = getDateStampByDate(getNormalizedDateString()) as number;
  const [selectedDateStamp, setSelectedDateStamp] = useState<number>(currentDateStamp as number);
  const [showDatePicker, toggleShowDatePicker] = useToggle(false);
  const dailyMemos = memoStore.state.memos
    .filter((m) => {
      const displayTimestamp = getTimeStampByDate(m.displayTs);
      const selectedDateStampWithOffset = selectedDateStamp + localSetting.dailyReviewTimeOffset * 60 * 60 * 1000;
      return (
        m.rowStatus === "NORMAL" &&
        m.creatorUsername === user.username &&
        displayTimestamp >= selectedDateStampWithOffset &&
        displayTimestamp < selectedDateStampWithOffset + DAILY_TIMESTAMP
      );
    })
    .sort((a, b) => getTimeStampByDate(a.displayTs) - getTimeStampByDate(b.displayTs));

  useEffect(() => {
    let offset = 0;
    const fetchMoreMemos = async () => {
      try {
        const fetchedMemos = await memoStore.fetchMemos("", DEFAULT_MEMO_LIMIT, offset);
        offset += fetchedMemos.length;
        if (fetchedMemos.length === DEFAULT_MEMO_LIMIT) {
          const lastMemo = last(fetchedMemos);
          if (lastMemo && lastMemo.displayTs > selectedDateStamp) {
            await fetchMoreMemos();
          }
        }
      } catch (error: any) {
        console.error(error);
        toast.error(error.response.data.message);
      }
    };
    fetchMoreMemos();
  }, [selectedDateStamp]);

  const handleDataPickerChange = (datestamp: number): void => {
    setSelectedDateStamp(datestamp);
    toggleShowDatePicker(false);
  };

  return (
    <section className="@container w-full max-w-3xl min-h-full flex flex-col justify-start items-center px-4 sm:px-2 sm:pt-4 pb-8 bg-zinc-100 dark:bg-zinc-800">
      <MobileHeader showSearch={false} />
      <div className="w-full shadow flex flex-col justify-start items-start px-4 py-3 rounded-xl bg-white dark:bg-zinc-700 text-black dark:text-gray-300">
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
            handleDateStampChange={handleDataPickerChange}
            isFutureDateDisabled
          />
        </div>
        <div className="w-full h-auto flex flex-col justify-start items-start px-2 pb-4 bg-white dark:bg-zinc-700">
          {dailyMemos.length === 0 && (
            <div className="w-full mt-4 mb-8 flex flex-col justify-center items-center italic">
              <Empty />
              <p className="mt-4 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
            </div>
          )}
          <div className="flex flex-col justify-start items-start w-full mt-2">
            {dailyMemos.map((memo, index) => (
              <div
                key={`${memo.id}-${memo.displayTs}`}
                className="relative w-full flex flex-col justify-start items-start pl-8 sm:pl-12 pt-2 pb-4"
              >
                <div className="w-full flex flex-row justify-start items-center mt-0.5 mb-1 text-sm font-mono text-gray-500 dark:text-gray-400">
                  <span className="opacity-80">{getTimeString(memo.displayTs)}</span>
                  <Icon.Dot className="w-5 h-auto opacity-60" />
                  <span className="opacity-60">#{memo.id}</span>
                </div>
                <MemoContent content={memo.content} />
                <MemoResourceListView resourceList={memo.resourceList} />
                <MemoRelationListView memo={memo} relationList={memo.relationList.filter((relation) => relation.type === "REFERENCE")} />
                <div className="absolute left-1 sm:left-2 top-3 h-full">
                  {index !== dailyMemos.length - 1 && (
                    <div className="absolute top-2 left-[7px] h-full w-0.5 bg-gray-400 dark:bg-gray-500 block"></div>
                  )}
                  <div className="border-4 rounded-full border-white relative dark:border-zinc-700">
                    <Icon.Circle className="w-2 h-auto bg-gray-400 text-gray-400 dark:bg-gray-500 dark:text-gray-500 rounded-full" />
                  </div>
                </div>
              </div>
            ))}

            {selectedDateStamp === currentDateStamp && (
              <div className="w-full pl-0 sm:pl-10 sm:mt-4">
                <MemoEditor className="!border" cacheKey="daily-review-editor" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DailyReview;
