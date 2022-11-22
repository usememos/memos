import { useTranslation } from "react-i18next";
import { useAppSelector } from "../store";
import { locationService, shortcutService } from "../services";
import * as utils from "../helpers/utils";
import { getTextWithMemoType } from "../helpers/filter";
import Icon from "./Icon";
import "../less/memo-filter.less";

const MemoFilter = () => {
  const { t } = useTranslation();
  useAppSelector((state) => state.shortcut.shortcuts);
  const query = useAppSelector((state) => state.location.query);
  const { tag: tagQuery, duration, type: memoType, text: textQuery, shortcutId, visibility } = query;
  const shortcut = shortcutId ? shortcutService.getShortcutById(shortcutId) : null;
  const showFilter = Boolean(tagQuery || (duration && duration.from < duration.to) || memoType || textQuery || shortcut || visibility);

  return (
    <div className={`filter-query-container ${showFilter ? "" : "!hidden"}`}>
      <span className="tip-text">{t("common.filter")}:</span>
      <div
        className={"filter-item-container " + (shortcut ? "" : "!hidden")}
        onClick={() => {
          locationService.setMemoShortcut(undefined);
        }}
      >
        <Icon.Target className="icon-text" /> {shortcut?.title}
      </div>
      <div
        className={"filter-item-container " + (tagQuery ? "" : "!hidden")}
        onClick={() => {
          locationService.setTagQuery(undefined);
        }}
      >
        <Icon.Tag className="icon-text" /> {tagQuery}
      </div>
      <div
        className={"filter-item-container " + (memoType ? "" : "!hidden")}
        onClick={() => {
          locationService.setMemoTypeQuery(undefined);
        }}
      >
        <Icon.Box className="icon-text" /> {t(getTextWithMemoType(memoType as MemoSpecType))}
      </div>
      <div
        className={"filter-item-container " + (visibility ? "" : "!hidden")}
        onClick={() => {
          locationService.setMemoVisibilityQuery(undefined);
        }}
      >
        <Icon.Eye className="icon-text" /> {visibility}
      </div>
      {duration && duration.from < duration.to ? (
        <div
          className="filter-item-container"
          onClick={() => {
            locationService.setFromAndToQuery();
          }}
        >
          <Icon.Calendar className="icon-text" /> {utils.getDateString(duration.from)} to {utils.getDateString(duration.to)}
        </div>
      ) : null}
      <div
        className={"filter-item-container " + (textQuery ? "" : "!hidden")}
        onClick={() => {
          locationService.setTextQuery(undefined);
        }}
      >
        <Icon.Search className="icon-text" /> {textQuery}
      </div>
    </div>
  );
};

export default MemoFilter;
