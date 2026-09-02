import dayjs from "dayjs";
import { isEqual } from "lodash-es";
import {
  BookmarkIcon,
  CalendarIcon,
  CheckCircleIcon,
  CodeIcon,
  EyeIcon,
  HashIcon,
  LinkIcon,
  type LucideIcon,
  MapPinIcon,
  ParenthesesIcon,
  SearchIcon,
  SquareCheckIcon,
  XIcon,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { type FilterFactor, getMemoFilterKey, type MemoFilter, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoViews } from "@/hooks/useUserQueries";
import { BUILTIN_TASKS_VIEW_ID, getMemoViewId, isMemoScopeRoute } from "@/lib/memo-views";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

const DATE_FILTER_FORMAT = "MMM D, YYYY";

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
    getLabel: (value) => {
      const date = dayjs(value);
      return date.isValid() ? date.format(DATE_FILTER_FORMAT) : value;
    },
  },
  pinned: {
    icon: BookmarkIcon,
    getLabel: (value) => value,
  },
  "property.hasLink": {
    icon: LinkIcon,
    getLabel: (_, t) => t("memo.filters.has-link"),
  },
  "property.hasTaskList": {
    icon: CheckCircleIcon,
    getLabel: (_, t) => t("memo.filters.has-task-list"),
  },
  "property.hasCode": {
    icon: CodeIcon,
    getLabel: (_, t) => t("memo.filters.has-code"),
  },
  "property.hasLocation": {
    icon: MapPinIcon,
    getLabel: (_, t) => t("memo.filters.has-location"),
  },
};

interface FilterChipProps {
  icon?: LucideIcon;
  label: string;
  onRemove: () => void;
}

/** One chip for anything narrowing the list, so a view, a tag and a day are announced the same way. */
const FilterChip = ({ icon: Icon, label, onRemove }: FilterChipProps) => (
  <div className="group inline-flex items-center gap-1.5 h-7 px-2.5 bg-accent/50 hover:bg-accent border border-border/50 rounded-full text-sm transition-all duration-200 hover:shadow-sm">
    {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
    <span className="text-foreground/80 font-medium max-w-32 truncate">{label}</span>
    <span className="ml-0.5 -mr-1">
      <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Remove filter">
        <XIcon className="w-3 h-3" />
      </Button>
    </span>
  </div>
);

const MemoFilters = ({ className }: { className?: string }) => {
  const t = useTranslate();
  const location = useLocation();
  const currentUser = useCurrentUser();
  const { filters, memoView, removeFilter, setMemoView } = useMemoFilterContext();
  // A remembered view only narrows the collection routes; elsewhere it is dormant and must not be echoed.
  const viewApplies = memoView !== undefined && isMemoScopeRoute(location.pathname);
  const { data: memoViews = [] } = useMemoViews(viewApplies ? currentUser?.name : undefined);

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

  const viewChip = (() => {
    if (!viewApplies) return null;
    if (memoView === BUILTIN_TASKS_VIEW_ID) return { icon: SquareCheckIcon, label: t("common.tasks") };
    const title = memoViews.find((item) => getMemoViewId(item.name) === memoView)?.title;
    return title ? { icon: ParenthesesIcon, label: title } : null;
  })();

  if (filters.length === 0 && !viewChip) {
    return null;
  }

  return (
    <div className={cn("w-full flex flex-row justify-start items-center flex-wrap gap-2", className)}>
      {viewChip && <FilterChip icon={viewChip.icon} label={viewChip.label} onRemove={() => setMemoView(undefined)} />}
      {filters.map((filter) => (
        <FilterChip
          key={getMemoFilterKey(filter)}
          icon={FILTER_CONFIGS[filter.factor]?.icon}
          label={getFilterDisplayText(filter)}
          onRemove={() => handleRemoveFilter(filter)}
        />
      ))}
    </div>
  );
};

MemoFilters.displayName = "MemoFilters";

export default MemoFilters;
