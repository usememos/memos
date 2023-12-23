import { useCallback, useEffect, useRef, useState } from "react";
import { memoServiceClient } from "@/grpcweb";
import { DAILY_TIMESTAMP } from "@/helpers/consts";
import { getDateStampByDate, getDateString, getTimeStampByDate } from "@/helpers/datetime";
import * as utils from "@/helpers/utils";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useGlobalStore } from "@/store/module";
import { useMemoStore } from "@/store/v1";
import { useTranslate, Translations } from "@/utils/i18n";
import "@/less/usage-heat-map.less";

interface DailyUsageStat {
  timestamp: number;
  count: number;
}

const tableConfig = {
  width: 10,
  height: 7,
};

const getInitialCreationStats = (usedDaysAmount: number, beginDayTimestamp: number): DailyUsageStat[] => {
  const initialUsageStat: DailyUsageStat[] = [];
  for (let i = 1; i <= usedDaysAmount; i++) {
    initialUsageStat.push({
      timestamp: beginDayTimestamp + DAILY_TIMESTAMP * i,
      count: 0,
    });
  }
  return initialUsageStat;
};

const MemoCreationHeatMap = () => {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const user = useCurrentUser();
  const memoStore = useMemoStore();
  const todayTimeStamp = getDateStampByDate(Date.now());
  const weekDay = new Date(todayTimeStamp).getDay();
  const weekFromMonday = ["zh-Hans", "ko"].includes(useGlobalStore().state.locale);
  const dayTips = weekFromMonday ? ["mon", "", "wed", "", "fri", "", "sun"] : ["sun", "", "tue", "", "thu", "", "sat"];
  const todayDay = weekFromMonday ? (weekDay == 0 ? 7 : weekDay) : weekDay + 1;
  const nullCell = new Array(7 - todayDay).fill(0);
  const usedDaysAmount = (tableConfig.width - 1) * tableConfig.height + todayDay;
  const beginDayTimestamp = todayTimeStamp - usedDaysAmount * DAILY_TIMESTAMP;
  const [memoAmount, setMemoAmount] = useState(0);
  const [creationStatus, setCreationStatus] = useState<DailyUsageStat[]>(getInitialCreationStats(usedDaysAmount, beginDayTimestamp));
  const containerElRef = useRef<HTMLDivElement>(null);
  const memos = Object.values(memoStore.getState().memoMapById);
  const createdDays = Math.ceil((Date.now() - getTimeStampByDate(user.createTime)) / 1000 / 3600 / 24);

  useEffect(() => {
    if (memos.length === 0) {
      return;
    }

    (async () => {
      const { memoCreationStats } = await memoServiceClient.getUserMemosStats({
        name: user.name,
      });
      const tempStats = getInitialCreationStats(usedDaysAmount, beginDayTimestamp);
      Object.entries(memoCreationStats).forEach(([k, v]) => {
        const dayIndex = Math.floor((getDateStampByDate(k) - beginDayTimestamp) / DAILY_TIMESTAMP) - 1;
        if (tempStats[dayIndex]) {
          tempStats[dayIndex].count = v;
        }
      });
      setCreationStatus(tempStats);
      setMemoAmount(Object.values(memoCreationStats).reduce((acc, cur) => acc + cur, 0));
    })();
  }, [memos.length, user.name]);

  const handleUsageStatItemMouseEnter = useCallback((event: React.MouseEvent, item: DailyUsageStat) => {
    const tempDiv = document.createElement("div");
    tempDiv.className = "usage-detail-container pop-up";
    const bounding = utils.getElementBounding(event.target as HTMLElement);
    tempDiv.style.left = bounding.left + "px";
    tempDiv.style.top = bounding.top - 2 + "px";
    const tMemoOnOpts = { amount: item.count, date: getDateString(item.timestamp as number) };
    tempDiv.innerHTML = item.count === 1 ? t("heatmap.memo-on", tMemoOnOpts) : t("heatmap.memos-on", tMemoOnOpts);
    document.body.appendChild(tempDiv);

    if (tempDiv.offsetLeft - tempDiv.clientWidth / 2 < 0) {
      tempDiv.style.left = bounding.left + tempDiv.clientWidth * 0.4 + "px";
      tempDiv.className += " offset-left";
    }
  }, []);

  const handleUsageStatItemMouseLeave = useCallback(() => {
    document.body.querySelectorAll("div.usage-detail-container.pop-up").forEach((node) => node.remove());
  }, []);

  const handleUsageStatItemClick = useCallback((item: DailyUsageStat) => {
    navigateTo(`/timeline?timestamp=${item.timestamp}`);
  }, []);

  // This interpolation is not being used because of the current styling,
  // but it can improve translation quality by giving it a more meaningful context
  const tMemoInOpts = { amount: memoAmount, period: "", date: "" };

  return (
    <>
      <div className="usage-heat-map-wrapper" ref={containerElRef}>
        <div className="usage-heat-map">
          {}
          {creationStatus.map((v, i) => {
            const count = v.count;
            const colorLevel =
              count <= 0
                ? ""
                : count <= 1
                ? "stat-day-l1-bg"
                : count <= 2
                ? "stat-day-l2-bg"
                : count <= 4
                ? "stat-day-l3-bg"
                : "stat-day-l4-bg";

            return (
              <div
                className="stat-wrapper"
                key={i}
                onMouseEnter={(e) => handleUsageStatItemMouseEnter(e, v)}
                onMouseLeave={handleUsageStatItemMouseLeave}
                onClick={() => handleUsageStatItemClick(v)}
              >
                <span className={`stat-container ${colorLevel} ${todayTimeStamp === v.timestamp ? "today" : ""}`}></span>
              </div>
            );
          })}
          {nullCell.map((_, i) => (
            <div className="stat-wrapper" key={i}>
              <span className="stat-container null"></span>
            </div>
          ))}
        </div>
        <div className="day-tip-text-container">
          {dayTips.map((v, i) => (
            <span className="tip-text" key={i}>
              {v && t(("days." + v) as Translations)}
            </span>
          ))}
        </div>
      </div>
      <p className="w-full pl-4 text-xs -mt-2 mb-3 text-gray-400 dark:text-zinc-400">
        <span className="font-medium text-gray-500 dark:text-zinc-300 number">{memoAmount} </span>
        {memoAmount === 1 ? t("heatmap.memo-in", tMemoInOpts) : t("heatmap.memos-in", tMemoInOpts)}{" "}
        <span className="font-medium text-gray-500 dark:text-zinc-300">{createdDays} </span>
        {createdDays === 1 ? t("heatmap.day", tMemoInOpts) : t("heatmap.days", tMemoInOpts)}
      </p>
    </>
  );
};

export default MemoCreationHeatMap;
