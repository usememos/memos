import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { type MemoFilter, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { BUILTIN_TASKS_VIEW_FILTER, BUILTIN_TASKS_VIEW_ID, getShortcutId } from "@/lib/memo-views";
import { buildMemoCreatorFilter } from "@/lib/resource-names";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";

const getVisibilityName = (visibility: Visibility): string => {
  switch (visibility) {
    case Visibility.PUBLIC:
      return "PUBLIC";
    case Visibility.PROTECTED:
      return "PROTECTED";
    case Visibility.PRIVATE:
      return "PRIVATE";
    default:
      return "PRIVATE";
  }
};

const escapeFilterValue = (value: string): string => JSON.stringify(value);

const getLocalDayTimestampRange = (value: string): { startTimestamp: number; endTimestamp: number } | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const startDate = new Date(year, month - 1, day);
  if (startDate.getFullYear() !== year || startDate.getMonth() !== month - 1 || startDate.getDate() !== day) return undefined;

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);
  return {
    startTimestamp: Math.floor(startDate.getTime() / 1000),
    endTimestamp: Math.floor(endDate.getTime() / 1000),
  };
};

export interface UseMemoFiltersOptions {
  creatorName?: string;
  includeShortcuts?: boolean;
  includePinned?: boolean;
  visibilities?: Visibility[];
}

interface BuildMemoFilterOptions {
  creatorName?: string;
  currentShortcut?: string;
  filters: MemoFilter[];
  includePinned: boolean;
  selectedShortcutFilter?: string;
  visibilities?: Visibility[];
}

export const buildMemoFilter = ({
  creatorName,
  currentShortcut,
  filters,
  includePinned,
  selectedShortcutFilter,
  visibilities,
}: BuildMemoFilterOptions): string | undefined => {
  const conditions: string[] = [];

  if (creatorName) {
    const creatorFilter = buildMemoCreatorFilter(creatorName);
    if (creatorFilter) {
      conditions.push(creatorFilter);
    }
  }

  if (currentShortcut === BUILTIN_TASKS_VIEW_ID) {
    conditions.push(BUILTIN_TASKS_VIEW_FILTER);
  } else if (selectedShortcutFilter) {
    conditions.push(selectedShortcutFilter);
  }

  for (const filter of filters) {
    if (filter.factor === "contentSearch") {
      conditions.push(`content.contains(${escapeFilterValue(filter.value)})`);
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
    } else if (filter.factor === "displayTime") {
      const range = getLocalDayTimestampRange(filter.value);
      if (range) {
        conditions.push(`created_ts >= timestamp(${range.startTimestamp}) && created_ts < timestamp(${range.endTimestamp})`);
      }
    }
  }

  if (visibilities && visibilities.length > 0) {
    const visibilityValues = visibilities.map((visibility) => `"${getVisibilityName(visibility)}"`).join(", ");
    conditions.push(`visibility in [${visibilityValues}]`);
  }

  return conditions.length > 0 ? conditions.join(" && ") : undefined;
};

export const useMemoFilters = (options: UseMemoFiltersOptions = {}): string | undefined => {
  const { creatorName, includeShortcuts = false, includePinned = false, visibilities } = options;

  const { shortcuts } = useAuth();
  const { filters, shortcut: currentShortcut } = useMemoFilterContext();

  // Get selected shortcut if needed
  const selectedShortcutFilter = useMemo(() => {
    if (!includeShortcuts || currentShortcut === BUILTIN_TASKS_VIEW_ID) return undefined;
    return shortcuts.find((shortcut) => getShortcutId(shortcut.name) === currentShortcut)?.filter;
  }, [includeShortcuts, currentShortcut, shortcuts]);

  return useMemo(
    () =>
      buildMemoFilter({
        creatorName,
        currentShortcut: includeShortcuts ? currentShortcut : undefined,
        filters,
        includePinned,
        selectedShortcutFilter,
        visibilities,
      }),
    [creatorName, currentShortcut, filters, includePinned, includeShortcuts, selectedShortcutFilter, visibilities],
  );
};
