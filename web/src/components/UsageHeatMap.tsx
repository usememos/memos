import { useCallback, useEffect, useRef, useState } from "react";
import { useAppSelector } from "../store";
import { locationService, userService } from "../services";
import { getMemoStats } from "../helpers/api";
import { DAILY_TIMESTAMP } from "../helpers/consts";
import * as utils from "../helpers/utils";
import "../less/usage-heat-map.less";

const tableConfig = {
  width: 12,
  height: 7,
};

const getInitialUsageStat = (usedDaysAmount: number, beginDayTimestamp: number): DailyUsageStat[] => {
  const initialUsageStat: DailyUsageStat[] = [];
  for (let i = 1; i <= usedDaysAmount; i++) {
    initialUsageStat.push({
      timestamp: beginDayTimestamp + DAILY_TIMESTAMP * i,
      count: 0,
    });
  }
  return initialUsageStat;
};

interface DailyUsageStat {
  timestamp: number;
  count: number;
}

const UsageHeatMap = () => {
  const todayTimeStamp = utils.getDateStampByDate(Date.now());
  const todayDay = new Date(todayTimeStamp).getDay() + 1;
  const nullCell = new Array(7 - todayDay).fill(0);
  const usedDaysAmount = (tableConfig.width - 1) * tableConfig.height + todayDay;
  const beginDayTimestamp = todayTimeStamp - usedDaysAmount * DAILY_TIMESTAMP;

  const { memos } = useAppSelector((state) => state.memo);
  const [allStat, setAllStat] = useState<DailyUsageStat[]>(getInitialUsageStat(usedDaysAmount, beginDayTimestamp));
  const [currentStat, setCurrentStat] = useState<DailyUsageStat | null>(null);
  const containerElRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getMemoStats(userService.getCurrentUserId())
      .then(({ data: { data } }) => {
        const newStat: DailyUsageStat[] = getInitialUsageStat(usedDaysAmount, beginDayTimestamp);
        for (const record of data) {
          const index = (utils.getDateStampByDate(record * 1000) - beginDayTimestamp) / (1000 * 3600 * 24) - 1;
          if (index >= 0) {
            newStat[index].count += 1;
          }
        }
        setAllStat([...newStat]);
      })
      .catch((error) => {
        console.error(error);
      });
  }, [memos.length]);

  const handleUsageStatItemMouseEnter = useCallback((event: React.MouseEvent, item: DailyUsageStat) => {
    const tempDiv = document.createElement("div");
    tempDiv.className = "usage-detail-container pop-up";
    const bounding = utils.getElementBounding(event.target as HTMLElement);
    tempDiv.style.left = bounding.left + "px";
    tempDiv.style.top = bounding.top - 2 + "px";
    tempDiv.innerHTML = `${item.count} memos on <span className="date-text">${new Date(item.timestamp as number).toDateString()}</span>`;
    document.body.appendChild(tempDiv);
  }, []);

  const handleUsageStatItemMouseLeave = useCallback(() => {
    document.body.querySelectorAll("div.usage-detail-container.pop-up").forEach((node) => node.remove());
  }, []);

  const handleUsageStatItemClick = useCallback((item: DailyUsageStat) => {
    if (locationService.getState().query?.duration?.from === item.timestamp) {
      locationService.setFromAndToQuery();
      setCurrentStat(null);
    } else if (item.count > 0) {
      locationService.setFromAndToQuery(item.timestamp, item.timestamp + DAILY_TIMESTAMP);
      setCurrentStat(item);
    }
  }, []);

  return (
    <div className="usage-heat-map-wrapper" ref={containerElRef}>
      <div className="day-tip-text-container">
        <span className="tip-text">Sun</span>
        <span className="tip-text"></span>
        <span className="tip-text">Tue</span>
        <span className="tip-text"></span>
        <span className="tip-text">Thu</span>
        <span className="tip-text"></span>
        <span className="tip-text">Sat</span>
      </div>
      <div className="usage-heat-map">
        {allStat.map((v, i) => {
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
              <span
                className={`stat-container ${colorLevel} ${currentStat === v ? "current" : ""} ${
                  todayTimeStamp === v.timestamp ? "today" : ""
                }`}
              ></span>
            </div>
          );
        })}
        {nullCell.map((_, i) => (
          <div className="stat-wrapper" key={i}>
            <span className="null"></span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UsageHeatMap;
