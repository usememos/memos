import { useMemo } from "react";
import { type MemoFilter, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { type MemoTimeBasis, useView } from "@/contexts/ViewContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useDevicePreferences } from "@/hooks/useDevicePreferences";
import { useMemoViews } from "@/hooks/useUserQueries";
import { buildTimestampRangeFilter, getLocalDayTimestampRange, getTimeBasisField } from "@/lib/calendar-utils";
import { combineCELFilters, TOP_LEVEL_MEMO_FILTER } from "@/lib/cel-filter";
import { getMemoViewId } from "@/lib/memo-views";
import { buildMemoCreatorFilter, getVisibilityName } from "@/lib/resource-names";
import { Visibility } from "@/types/proto/api/memo_service_pb";

const escapeFilterValue = (value: string): string => JSON.stringify(value);

export interface UseMemoFiltersOptions {
  creatorName?: string;
  includeMemoViews?: boolean;
  includePinned?: boolean;
  visibilities?: Visibility[];
}

interface BuildMemoFilterOptions {
  creatorName?: string;
  filters: MemoFilter[];
  includePinned: boolean;
  selectedMemoViewFilter?: string;
  visibilities?: Visibility[];
  /** Which timestamp a `displayTime` day filter selects on; defaults to creation time. */
  timeBasis?: MemoTimeBasis;
  /** Leaves comments out. A memo list includes them unless its filter says otherwise. */
  topLevelOnly?: boolean;
}

export const buildMemoFilter = ({
  creatorName,
  filters,
  includePinned,
  selectedMemoViewFilter,
  visibilities,
  timeBasis = "create_time",
  topLevelOnly = false,
}: BuildMemoFilterOptions): string | undefined => {
  const conditions: string[] = [];

  if (topLevelOnly) {
    conditions.push(TOP_LEVEL_MEMO_FILTER);
  }

  if (creatorName) {
    const creatorFilter = buildMemoCreatorFilter(creatorName);
    if (creatorFilter) {
      conditions.push(creatorFilter);
    }
  }

  if (selectedMemoViewFilter) {
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
    } else if (filter.factor === "property.hasAttachments") {
      conditions.push(`has_attachments`);
    } else if (filter.factor === "property.hasImage") {
      conditions.push(`has_image`);
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

/** The filter term that keeps comments out of a memo list or its statistics, unless the viewer chose to include them. */
export const useCommentScopeFilter = (): string | undefined => {
  const { includeComments } = useDevicePreferences();
  return includeComments ? undefined : TOP_LEVEL_MEMO_FILTER;
};

/** Stored CEL filter of the saved View selected in the sidebar. */
export const useSelectedMemoViewFilter = (): string | undefined => {
  const currentUser = useCurrentUser();
  const { memoView } = useMemoFilterContext();
  const { data: memoViews = [] } = useMemoViews(currentUser?.name);
  return useMemo(() => {
    return memoViews.find((view) => getMemoViewId(view.name) === memoView)?.filter;
  }, [memoView, memoViews]);
};

export const useMemoFilters = (options: UseMemoFiltersOptions = {}): string | undefined => {
  const { creatorName, includeMemoViews = false, includePinned = false, visibilities } = options;

  const { filters } = useMemoFilterContext();
  const selectedMemoViewFilter = useSelectedMemoViewFilter();
  // The sidebar calendar buckets days by this basis, so a picked day must select on it too.
  const { timeBasis } = useView();
  const { includeComments } = useDevicePreferences();

  return useMemo(
    () =>
      buildMemoFilter({
        creatorName,
        filters,
        includePinned,
        selectedMemoViewFilter: includeMemoViews ? selectedMemoViewFilter : undefined,
        visibilities,
        timeBasis,
        topLevelOnly: !includeComments,
      }),
    [creatorName, filters, includePinned, includeMemoViews, selectedMemoViewFilter, visibilities, timeBasis, includeComments],
  );
};
