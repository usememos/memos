import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useFilterStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import Icon from "./Icon";

const MemoFilter = () => {
  const t = useTranslate();
  const location = useLocation();
  const filterStore = useFilterStore();
  const filter = filterStore.state;
  const { tag: tagQuery, text: textQuery, visibility } = filter;
  const showFilter = Boolean(tagQuery || textQuery || visibility);

  useEffect(() => {
    filterStore.clearFilter();
  }, [location]);

  return (
    <div
      className={`flex flex-row justify-start items-start w-full flex-wrap px-2 pb-2 text-sm font-mono leading-7 dark:text-gray-400 ${
        showFilter ? "" : "!hidden"
      }`}
    >
      <span className="mx-2 text-gray-400">{t("common.filter")}:</span>
      <div
        className={
          "max-w-xs flex flex-row justify-start items-center px-2 mr-2 cursor-pointer dark:text-gray-400 bg-gray-200 dark:bg-zinc-800 rounded whitespace-nowrap truncate hover:line-through " +
          (tagQuery ? "" : "!hidden")
        }
        onClick={() => {
          filterStore.setTagFilter(undefined);
        }}
      >
        <Icon.Tag className="w-4 h-auto mr-1 text-gray-500 dark:text-gray-400" /> {tagQuery}
        <Icon.X className="w-4 h-auto ml-1 opacity-40" />
      </div>
      <div
        className={
          "max-w-xs flex flex-row justify-start items-center px-2 mr-2 cursor-pointer dark:text-gray-400 bg-gray-200 dark:bg-zinc-800 rounded whitespace-nowrap truncate hover:line-through " +
          (visibility ? "" : "!hidden")
        }
        onClick={() => {
          filterStore.setMemoVisibilityFilter(undefined);
        }}
      >
        <Icon.Eye className="w-4 h-auto mr-1 text-gray-500 dark:text-gray-400" /> {visibility}
        <Icon.X className="w-4 h-auto ml-1 opacity-40" />
      </div>
      <div
        className={
          "max-w-xs flex flex-row justify-start items-center px-2 mr-2 cursor-pointer dark:text-gray-400 bg-gray-200 dark:bg-zinc-800 rounded whitespace-nowrap truncate hover:line-through " +
          (textQuery ? "" : "!hidden")
        }
        onClick={() => {
          filterStore.setTextFilter(undefined);
        }}
      >
        <Icon.Search className="w-4 h-auto mr-1 text-gray-500 dark:text-gray-400" /> {textQuery}
        <Icon.X className="w-4 h-auto ml-1 opacity-40" />
      </div>
    </div>
  );
};

export default MemoFilter;
