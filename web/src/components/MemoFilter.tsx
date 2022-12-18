import { useTranslation } from "react-i18next";
import { useLocationStore, useShortcutStore } from "../store/module";
import * as utils from "../helpers/utils";
import { getTextWithMemoType } from "../helpers/filter";
import Icon from "./Icon";
import "../less/memo-filter.less";

const MemoFilter = () => {
  const { t } = useTranslation();
  const locationStore = useLocationStore();
  const shortcutStore = useShortcutStore();
  const query = locationStore.state.query;
  const { tag: tagQuery, duration, type: memoType, text: textQuery, shortcutId, visibility } = query;
  const shortcut = shortcutId ? shortcutStore.getShortcutById(shortcutId) : null;
  const showFilter = Boolean(tagQuery || (duration && duration.from < duration.to) || memoType || textQuery || shortcut || visibility);

  return (
    <div className={`filter-query-container ${showFilter ? "" : "!hidden"}`}>
      <span className="mx-2 text-gray-400">{t("common.filter")}:</span>
      <div
        className={"filter-item-container " + (shortcut ? "" : "!hidden")}
        onClick={() => {
          locationStore.setMemoShortcut(undefined);
        }}
      >
        <Icon.Target className="icon-text" /> {shortcut?.title}
      </div>
      <div
        className={"filter-item-container " + (tagQuery ? "" : "!hidden")}
        onClick={() => {
          locationStore.setTagQuery(undefined);
        }}
      >
        <Icon.Tag className="icon-text" /> {tagQuery}
      </div>
      <div
        className={"filter-item-container " + (memoType ? "" : "!hidden")}
        onClick={() => {
          locationStore.setMemoTypeQuery(undefined);
        }}
      >
        <Icon.Box className="icon-text" /> {t(getTextWithMemoType(memoType as MemoSpecType))}
      </div>
      <div
        className={"filter-item-container " + (visibility ? "" : "!hidden")}
        onClick={() => {
          locationStore.setMemoVisibilityQuery(undefined);
        }}
      >
        <Icon.Eye className="icon-text" /> {visibility}
      </div>
      {duration && duration.from < duration.to ? (
        <div
          className="filter-item-container"
          onClick={() => {
            locationStore.setFromAndToQuery();
          }}
        >
          <Icon.Calendar className="icon-text" /> {utils.getDateString(duration.from)} to {utils.getDateString(duration.to)}
        </div>
      ) : null}
      <div
        className={"filter-item-container " + (textQuery ? "" : "!hidden")}
        onClick={() => {
          locationStore.setTextQuery(undefined);
        }}
      >
        <Icon.Search className="icon-text" /> {textQuery}
      </div>
    </div>
  );
};

export default MemoFilter;
