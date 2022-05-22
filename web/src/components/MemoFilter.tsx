import { useAppSelector } from "../store";
import { locationService, shortcutService } from "../services";
import utils from "../helpers/utils";
import { getTextWithMemoType } from "../helpers/filter";
import "../less/memo-filter.less";

interface FilterProps {}

const MemoFilter: React.FC<FilterProps> = () => {
  const {
    location: { query },
  } = useAppSelector((state) => state);
  const { tag: tagQuery, duration, type: memoType, text: textQuery, shortcutId } = query ?? {};
  const shortcut = shortcutId ? shortcutService.getShortcutById(shortcutId) : null;
  const showFilter = Boolean(tagQuery || (duration && duration.from < duration.to) || memoType || textQuery || shortcut);

  return (
    <div className={`filter-query-container ${showFilter ? "" : "hidden"}`}>
      <span className="tip-text">Filter:</span>
      <div
        className={"filter-item-container " + (shortcut ? "" : "hidden")}
        onClick={() => {
          locationService.setMemoShortcut(undefined);
        }}
      >
        <span className="icon-text">🎯</span> {shortcut?.title}
      </div>
      <div
        className={"filter-item-container " + (tagQuery ? "" : "hidden")}
        onClick={() => {
          locationService.setTagQuery(undefined);
        }}
      >
        <span className="icon-text">🏷️</span> {tagQuery}
      </div>
      <div
        className={"filter-item-container " + (memoType ? "" : "hidden")}
        onClick={() => {
          locationService.setMemoTypeQuery(undefined);
        }}
      >
        <span className="icon-text">📦</span> {getTextWithMemoType(memoType as MemoSpecType)}
      </div>
      {duration && duration.from < duration.to ? (
        <div
          className="filter-item-container"
          onClick={() => {
            locationService.setFromAndToQuery();
          }}
        >
          <span className="icon-text">🗓️</span> {utils.getDateString(duration.from)} to {utils.getDateString(duration.to)}
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
