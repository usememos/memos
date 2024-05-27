import clsx from "clsx";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useFilterStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import Icon from "./Icon";

interface Props {
  className?: string;
}

const MemoFilter = (props: Props) => {
  const t = useTranslate();
  const location = useLocation();
  const filterStore = useFilterStore();
  const filter = filterStore.state;
  const showFilter = Boolean(
    filter.tag ||
      filter.text ||
      filter.visibility ||
      filter.memoPropertyFilter?.hasLink ||
      filter.memoPropertyFilter?.hasTaskList ||
      filter.memoPropertyFilter?.hasCode,
  );

  useEffect(() => {
    filterStore.clearFilter();
  }, [location]);

  if (!showFilter) {
    return null;
  }

  return (
    <div
      className={clsx(
        `w-full flex flex-row justify-start items-start flex-wrap gap-2 text-sm leading-7 dark:text-gray-400`,
        props.className,
      )}
    >
      <div className="shrink-0 flex flex-row justify-start items-center text-gray-400">
        <Icon.Filter className="w-4 h-auto mr-1" />
        <span>{t("common.filter")}:</span>
      </div>
      {filter.tag && (
        <div
          className="max-w-xs flex flex-row justify-start items-center px-2 cursor-pointer dark:text-gray-400 bg-gray-200 dark:bg-zinc-800 rounded whitespace-nowrap truncate hover:line-through"
          onClick={() => {
            filterStore.setTagFilter(undefined);
          }}
        >
          <Icon.Hash className="w-4 h-auto mr-1 text-gray-500 dark:text-gray-400" /> {filter.tag}
          <Icon.X className="w-4 h-auto ml-1 opacity-40" />
        </div>
      )}
      {filter.visibility && (
        <div
          className="max-w-xs flex flex-row justify-start items-center px-2 cursor-pointer dark:text-gray-400 bg-gray-200 dark:bg-zinc-800 rounded whitespace-nowrap truncate hover:line-through"
          onClick={() => {
            filterStore.setMemoVisibilityFilter(undefined);
          }}
        >
          <Icon.Eye className="w-4 h-auto mr-1 text-gray-500 dark:text-gray-400" /> {filter.visibility}
          <Icon.X className="w-4 h-auto ml-1 opacity-40" />
        </div>
      )}
      {filter.text && (
        <div
          className="max-w-xs flex flex-row justify-start items-center px-2 cursor-pointer dark:text-gray-400 bg-gray-200 dark:bg-zinc-800 rounded whitespace-nowrap truncate hover:line-through"
          onClick={() => {
            filterStore.setTextFilter(undefined);
          }}
        >
          <Icon.Search className="w-4 h-auto mr-1 text-gray-500 dark:text-gray-400" /> {filter.text}
          <Icon.X className="w-4 h-auto ml-1 opacity-40" />
        </div>
      )}
      {filter.memoPropertyFilter?.hasLink && (
        <div
          className="max-w-xs flex flex-row justify-start items-center px-2 cursor-pointer dark:text-gray-400 bg-gray-200 dark:bg-zinc-800 rounded whitespace-nowrap truncate hover:line-through"
          onClick={() => {
            filterStore.setMemoPropertyFilter({ hasLink: false });
          }}
        >
          <Icon.Link className="w-4 h-auto mr-1 text-gray-500 dark:text-gray-400" /> Has Link
          <Icon.X className="w-4 h-auto ml-1 opacity-40" />
        </div>
      )}
      {filter.memoPropertyFilter?.hasTaskList && (
        <div
          className="max-w-xs flex flex-row justify-start items-center px-2 cursor-pointer dark:text-gray-400 bg-gray-200 dark:bg-zinc-800 rounded whitespace-nowrap truncate hover:line-through"
          onClick={() => {
            filterStore.setMemoPropertyFilter({ hasTaskList: false });
          }}
        >
          <Icon.CheckCircle className="w-4 h-auto mr-1 text-gray-500 dark:text-gray-400" /> Has Task
          <Icon.X className="w-4 h-auto ml-1 opacity-40" />
        </div>
      )}
      {filter.memoPropertyFilter?.hasCode && (
        <div
          className="max-w-xs flex flex-row justify-start items-center px-2 cursor-pointer dark:text-gray-400 bg-gray-200 dark:bg-zinc-800 rounded whitespace-nowrap truncate hover:line-through"
          onClick={() => {
            filterStore.setMemoPropertyFilter({ hasCode: false });
          }}
        >
          <Icon.Code2 className="w-4 h-auto mr-1 text-gray-500 dark:text-gray-400" /> Has Code
          <Icon.X className="w-4 h-auto ml-1 opacity-40" />
        </div>
      )}
    </div>
  );
};

export default MemoFilter;
