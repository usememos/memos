import { isEqual } from "lodash-es";
import { CalendarIcon, CheckCircleIcon, CodeIcon, EyeIcon, HashIcon, LinkIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FilterFactor, getMemoFilterKey, MemoFilter, stringifyFilters, useMemoFilterStore } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";

const MemoFilters = () => {
  const t = useTranslate();
  const [, setSearchParams] = useSearchParams();
  const memoFilterStore = useMemoFilterStore();
  const filters = memoFilterStore.filters;

  useEffect(() => {
    const searchParams = new URLSearchParams();
    if (filters.length > 0) {
      searchParams.set("filter", stringifyFilters(filters));
    }
    setSearchParams(searchParams);
  }, [filters]);

  const getFilterDisplayText = (filter: MemoFilter) => {
    if (filter.value) {
      return filter.value;
    }
    if (filter.factor.startsWith("property.")) {
      const factorLabel = filter.factor.replace("property.", "");
      switch (factorLabel) {
        case "hasLink":
          return t("filters.has-link");
        case "hasCode":
          return t("filters.has-code");
        case "hasTaskList":
          return t("filters.has-task-list");
        default:
          return factorLabel;
      }
    }
    return filter.factor;
  };

  if (filters.length === 0) {
    return undefined;
  }

  return (
    <div className="w-full mt-2 flex flex-row justify-start items-center flex-wrap gap-x-2 gap-y-1">
      {filters.map((filter) => (
        <div
          key={getMemoFilterKey(filter)}
          className="w-auto leading-7 h-7 shrink-0 flex flex-row items-center gap-1 bg-white dark:bg-zinc-800 border dark:border-zinc-700 pl-1.5 pr-1 rounded-md hover:line-through cursor-pointer"
          onClick={() => memoFilterStore.removeFilter((f) => isEqual(f, filter))}
        >
          <FactorIcon className="w-4 h-auto text-gray-500 dark:text-gray-400 opacity-60" factor={filter.factor} />
          <span className="text-gray-500 dark:text-gray-400 text-sm max-w-32 truncate">{getFilterDisplayText(filter)}</span>
          <button className="text-gray-500 dark:text-gray-300 opacity-60 hover:opacity-100">
            <XIcon className="w-4 h-auto" />
          </button>
        </div>
      ))}
    </div>
  );
};

const FactorIcon = ({ factor, className }: { factor: FilterFactor; className?: string }) => {
  const iconMap = {
    tagSearch: <HashIcon className={className} />,
    visibility: <EyeIcon className={className} />,
    contentSearch: <SearchIcon className={className} />,
    displayTime: <CalendarIcon className={className} />,
    "property.hasLink": <LinkIcon className={className} />,
    "property.hasTaskList": <CheckCircleIcon className={className} />,
    "property.hasCode": <CodeIcon className={className} />,
  };
  return iconMap[factor as keyof typeof iconMap] || <></>;
};

export default MemoFilters;
