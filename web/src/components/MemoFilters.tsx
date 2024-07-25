import { isEqual } from "lodash-es";
import { useMemoFilterStore } from "@/store/v1";
import Icon from "./Icon";

const MemoFilters = () => {
  const memoFilterStore = useMemoFilterStore();
  const filters = memoFilterStore.filters;

  if (filters.length === 0) {
    return undefined;
  }

  return (
    <div className="w-full mb-2 flex flex-row justify-start items-start gap-2">
      <span className="flex flex-row items-center gap-0.5 text-gray-500 text-sm leading-6">
        <Icon.Filter className="w-4 h-auto opacity-60 inline" />
        Filters
      </span>
      <div className="flex flex-row justify-start items-center flex-wrap gap-2 leading-6">
        {filters.map((filter) => (
          <div
            key={filter.factor}
            className="flex flex-row items-center gap-1 bg-gray-100 dark:bg-zinc-800 border dark:border-zinc-700 px-1 rounded-md"
          >
            <span className="text-gray-600 dark:text-gray-500 text-sm">{filter.factor}</span>
            {filter.value && <span className="text-gray-500 dark:text-gray-400 text-sm max-w-12 truncate">{filter.value}</span>}
            <button
              onClick={() => memoFilterStore.removeFilter((f) => isEqual(f, filter))}
              className="text-gray-500 dark:text-gray-300 opacity-60 hover:opacity-100"
            >
              <Icon.X className="w-3 h-auto" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MemoFilters;
