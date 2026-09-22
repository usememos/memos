import { useMemo } from "react";
import { type MemoFilter, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { type MemoTimeBasis, useView } from "@/contexts/ViewContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoViews } from "@/hooks/useUserQueries";
import { buildTimestampRangeFilter, getLocalDayTimestampRange, getTimeBasisField } from "@/lib/calendar-utils";
import { combineCELFilters } from "@/lib/cel-filter";
import { BUILTIN_TASKS_VIEW_FILTER, BUILTIN_TASKS_VIEW_ID, getMemoViewId } from "@/lib/memo-views";
import { buildMemoCreatorFilter, getVisibilityName } from "@/lib/resource-names";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";

const escapeFilterValue = (value: string): string => JSON.stringify(value);

export interface UseMemoFiltersOptions {
  creatorName?: string;
  includeMemoViews?: boolean;
  includePinned?: boolean;
  visibilities?: Visibility[];
}

interface BuildMemoFilterOptions {
  creatorName?: string;
  currentMemoView?: string;
  filters: MemoFilter[];
  includePinned: boolean;
  selectedMemoViewFilter?: string;
  visibilities?: Visibility[];
  /** Which timestamp a `displayTime` day filter selects on; defaults to creation time. */
  timeBasis?: MemoTimeBasis;
}

export const buildMemoFilter = ({
  creatorName,
  currentMemoView,
  filters,
  includePinned,
  selectedMemoViewFilter,
  visibilities,
  timeBasis = "create_time",
}: BuildMemoFilterOptions): string | undefined => {
  const conditions: string[] = [];

  if (creatorName) {
    const creatorFilter = buildMemoCreatorFilter(creatorName);
    if (creatorFilter) {
      conditions.push(creatorFilter);
    }
  }

  if (currentMemoView === BUILTIN_TASKS_VIEW_ID) {
    conditions.push(BUILTIN_TASKS_VIEW_FILTER);
  } else if (selectedMemoViewFilter) {
    conditions.push(selectedMemoViewFilter);
  }

  for (const filter of filters) {
    if (filter.factor === "contentSearch") {
      conditions.push(`content.contains(${escapeFilterValue(filter.value)})`);
    } else if (filter.factor === "celSearch") {
      conditions.push(filter.value);
    } else if (filter.factor === "tagSearch") {
      conditions.push(`tag in [${escapeFilterValue(filter.value)}]`);
    } else if (filter.factor === "pinned") {
      if (includePinned) {
        conditions.push(`pinned`);
      }
    } else if (filter.factor === "property.hasLink") {
      conditions.push(`has_link`);
    } else if (filter.factor === "property.hasTaskList") {
      conditions.push(`has_task_list`);
    } else if (filter.factor === "property.hasCode") {
      conditions.push(`has_code`);
    } else if (filter.factor === "property.hasLocation") {
      conditions.push(`has_location`);
    } else if (filter.factor === "displayTime") {
      const range = getLocalDayTimestampRange(filter.value);
      if (range) {
        conditions.push(buildTimestampRangeFilter(getTimeBasisField(timeBasis), range));
      }
    }
  }

  if (visibilities && visibilities.length > 0) {
    const visibilityValues = visibilities.map((visibility) => `"${getVisibilityName(visibility)}"`).join(", ");
    conditions.push(`visibility in [${visibilityValues}]`);
  }

  return combineCELFilters(...conditions);
};

/** CEL filter of the View selected in the sidebar: the built-in Tasks filter or the saved View's stored filter. */
export const useSelectedMemoViewFilter = (): string | undefined => {
  const currentUser = useCurrentUser();
  const { memoView } = useMemoFilterContext();
  const { data: memoViews = [] } = useMemoViews(currentUser?.name);
  return useMemo(() => {
    if (memoView === BUILTIN_TASKS_VIEW_ID) return BUILTIN_TASKS_VIEW_FILTER;
    return memoViews.find((view) => getMemoViewId(view.name) === memoView)?.filter;
  }, [memoView, memoViews]);
};

export const useMemoFilters = (options: UseMemoFiltersOptions = {}): string | undefined => {
  const { creatorName, includeMemoViews = false, includePinned = false, visibilities } = options;

  const { filters, memoView: currentMemoView } = useMemoFilterContext();
  const selectedMemoViewFilter = useSelectedMemoViewFilter();
  // The sidebar calendar buckets days by this basis, so a picked day must select on it too.
  const { timeBasis } = useView();

  return useMemo(
    () =>
      buildMemoFilter({
        creatorName,
        currentMemoView: includeMemoViews ? currentMemoView : undefined,
        filters,
        includePinned,
        selectedMemoViewFilter: includeMemoViews ? selectedMemoViewFilter : undefined,
        visibilities,
        timeBasis,
      }),
    [creatorName, currentMemoView, filters, includePinned, includeMemoViews, selectedMemoViewFilter, visibilities, timeBasis],
  );
};
