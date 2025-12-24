import { isEqual } from "lodash-es";
import {
  BookmarkIcon,
  CalendarIcon,
  CheckCircleIcon,
  CodeIcon,
  EyeIcon,
  HashIcon,
  LinkIcon,
  LucideIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { FilterFactor, getMemoFilterKey, MemoFilter, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useTranslate } from "@/utils/i18n";

interface FilterConfig {
  icon: LucideIcon;
  getLabel: (value: string, t: ReturnType<typeof useTranslate>) => string;
}

const FILTER_CONFIGS: Record<FilterFactor, FilterConfig> = {
  tagSearch: {
    icon: HashIcon,
    getLabel: (value) => value,
  },
  visibility: {
    icon: EyeIcon,
    getLabel: (value) => value,
  },
  contentSearch: {
    icon: SearchIcon,
    getLabel: (value) => value,
  },
  displayTime: {
    icon: CalendarIcon,
    getLabel: (value) => value,
  },
  pinned: {
    icon: BookmarkIcon,
    getLabel: (value) => value,
  },
  "property.hasLink": {
    icon: LinkIcon,
    getLabel: (_, t) => t("filters.has-link"),
  },
  "property.hasTaskList": {
    icon: CheckCircleIcon,
    getLabel: (_, t) => t("filters.has-task-list"),
  },
  "property.hasCode": {
    icon: CodeIcon,
    getLabel: (_, t) => t("filters.has-code"),
  },
};

const MemoFilters = () => {
  const t = useTranslate();
  const { filters, removeFilter } = useMemoFilterContext();

  const handleRemoveFilter = (filter: MemoFilter) => {
    removeFilter((f: MemoFilter) => isEqual(f, filter));
  };

  const getFilterDisplayText = (filter: MemoFilter): string => {
    const config = FILTER_CONFIGS[filter.factor];
    if (!config) {
      return filter.value || filter.factor;
    }
    return config.getLabel(filter.value, t);
  };

  if (filters.length === 0) {
    return null;
  }

  return (
    <div className="w-full mb-2 flex flex-row justify-start items-center flex-wrap gap-2">
      {filters.map((filter) => {
        const config = FILTER_CONFIGS[filter.factor];
        const Icon = config?.icon;

        return (
          <div
            key={getMemoFilterKey(filter)}
            className="group inline-flex items-center gap-1.5 h-7 px-2.5 bg-accent/50 hover:bg-accent border border-border/50 rounded-full text-sm transition-all duration-200 hover:shadow-sm"
          >
            {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
            <span className="text-foreground/80 font-medium max-w-32 truncate">{getFilterDisplayText(filter)}</span>
            <button
              onClick={() => handleRemoveFilter(filter)}
              className="ml-0.5 -mr-1 p-0.5 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
              aria-label="Remove filter"
            >
              <XIcon className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

MemoFilters.displayName = "MemoFilters";

export default MemoFilters;
