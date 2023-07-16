import { useEffect } from "react";
import { useTranslate } from "@/utils/i18n";
import { useLocation } from "react-router-dom";
import { useFilterStore, useShortcutStore } from "@/store/module";
import { getDateString } from "@/helpers/datetime";
import { getTextWithMemoType } from "@/helpers/filter";
import Icon from "./Icon";
import "@/less/memo-filter.less";

const MemoFilter = () => {
  const t = useTranslate();
  const location = useLocation();
  const filterStore = useFilterStore();
  const shortcutStore = useShortcutStore();
  const filter = filterStore.state;
  const { tag: tagQuery, duration, type: memoType, text: textQuery, shortcutId, visibility } = filter;
  const shortcut = shortcutId ? shortcutStore.getShortcutById(shortcutId) : null;
  const showFilter = Boolean(tagQuery || (duration && duration.from < duration.to) || memoType || textQuery || shortcut || visibility);

  useEffect(() => {
    filterStore.clearFilter();
  }, [location]);

  return (
    <div className={`filter-query-container ${showFilter ? "" : "!hidden"}`}>
      <span className="mx-2 text-gray-400">{t("common.filter")}:</span>
      <div
        className={"filter-item-container " + (shortcut ? "" : "!hidden")}
        onClick={() => {
          filterStore.setMemoShortcut(undefined);
        }}
      >
        <Icon.Target className="icon-text" /> {shortcut?.title}
        <Icon.X className="w-4 h-auto ml-1 opacity-40" />
      </div>
      <div
        className={"filter-item-container " + (tagQuery ? "" : "!hidden")}
        onClick={() => {
          filterStore.setTagFilter(undefined);
        }}
      >
        <Icon.Tag className="icon-text" /> {tagQuery}
        <Icon.X className="w-4 h-auto ml-1 opacity-40" />
      </div>
      <div
        className={"filter-item-container " + (memoType ? "" : "!hidden")}
        onClick={() => {
          filterStore.setMemoTypeFilter(undefined);
        }}
      >
        <Icon.Box className="icon-text" />{" "}
        {t(getTextWithMemoType(memoType as MemoSpecType) as Exclude<ReturnType<typeof getTextWithMemoType>, "">)}
        <Icon.X className="w-4 h-auto ml-1 opacity-40" />
      </div>
      <div
        className={"filter-item-container " + (visibility ? "" : "!hidden")}
        onClick={() => {
          filterStore.setMemoVisibilityFilter(undefined);
        }}
      >
        <Icon.Eye className="icon-text" /> {visibility}
        <Icon.X className="w-4 h-auto ml-1 opacity-40" />
      </div>
      {duration && duration.from < duration.to ? (
        <div
          className="filter-item-container"
          onClick={() => {
            filterStore.setFromAndToFilter();
          }}
        >
          <Icon.Calendar className="icon-text" />
          {t("common.filter-period", {
            from: getDateString(duration.from),
            to: getDateString(duration.to),
            interpolation: { escapeValue: false },
          })}
          <Icon.X className="w-4 h-auto ml-1 opacity-40" />
        </div>
      ) : null}
      <div
        className={"filter-item-container " + (textQuery ? "" : "!hidden")}
        onClick={() => {
          filterStore.setTextFilter(undefined);
        }}
      >
        <Icon.Search className="icon-text" /> {textQuery}
        <Icon.X className="w-4 h-auto ml-1 opacity-40" />
      </div>
    </div>
  );
};

export default MemoFilter;
