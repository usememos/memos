import { useContext } from "react";
import appContext from "../stores/appContext";
import { locationService, shortcutService } from "../services";
import utils from "../helpers/utils";
import { getTextWithMemoType } from "../helpers/filter";
import "../less/memo-filter.less";

interface FilterProps {}

const MemoFilter: React.FC<FilterProps> = () => {
  const {
    locationState: { query },
  } = useContext(appContext);

  const { tag: tagQuery, duration, type: memoType, text: textQuery, shortcutId } = query;
  const queryFilter = shortcutService.getShortcutById(shortcutId);
  const showFilter = Boolean(tagQuery || (duration && duration.from < duration.to) || memoType || textQuery || queryFilter);

  return (
    <div className={`filter-query-container ${showFilter ? "" : "hidden"}`}>
      <span className="tip-text">筛选：</span>
      <div
        className={"filter-item-container " + (queryFilter ? "" : "hidden")}
        onClick={() => {
          locationService.setMemoShortcut("");
        }}
      >
        <span className="icon-text">🔖</span> {queryFilter?.title}
      </div>
      <div
        className={"filter-item-container " + (tagQuery ? "" : "hidden")}
        onClick={() => {
          locationService.setTagQuery("");
        }}
      >
        <span className="icon-text">🏷️</span> {tagQuery}
      </div>
      <div
        className={"filter-item-container " + (memoType ? "" : "hidden")}
        onClick={() => {
          locationService.setMemoTypeQuery("");
        }}
      >
        <span className="icon-text">📦</span> {getTextWithMemoType(memoType as MemoSpecType)}
      </div>
      {duration && duration.from < duration.to ? (
        <div
          className="filter-item-container"
          onClick={() => {
            locationService.setFromAndToQuery(0, 0);
          }}
        >
          <span className="icon-text">🗓️</span> {utils.getDateString(duration.from)} 至 {utils.getDateString(duration.to)}
        </div>
      ) : null}
      <div
        className={"filter-item-container " + (textQuery ? "" : "hidden")}
        onClick={() => {
          locationService.setTextQuery("");
        }}
      >
        <span className="icon-text">🔍</span> {textQuery}
      </div>
    </div>
  );
};

export default MemoFilter;
