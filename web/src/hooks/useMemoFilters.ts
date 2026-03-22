import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";

const extractUserIdFromName = (name: string): string => {
  const match = name.match(/users\/(\d+)/);
  return match ? match[1] : "";
};

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

const getShortcutId = (name: string): string => {
  const parts = name.split("/");
  return parts.length === 4 ? parts[3] : "";
};

export interface UseMemoFiltersOptions {
  creatorName?: string;
  includeShortcuts?: boolean;
  includePinned?: boolean;
  visibilities?: Visibility[];
}

export const useMemoFilters = (options: UseMemoFiltersOptions = {}): string | undefined => {
  const { creatorName, includeShortcuts = false, includePinned = false, visibilities } = options;

  const { shortcuts } = useAuth();
  const { filters, shortcut: currentShortcut } = useMemoFilterContext();
  const { memoRelatedSetting } = useInstance();

  // Get selected shortcut if needed
  const selectedShortcut = useMemo(() => {
    if (!includeShortcuts) return undefined;
    return shortcuts.find((shortcut) => getShortcutId(shortcut.name) === currentShortcut);
  }, [includeShortcuts, currentShortcut, shortcuts]);

  // Build filter
  return useMemo(() => {
    const conditions: string[] = [];

    // Add creator filter if provided
    if (creatorName) {
      conditions.push(`creator_id == ${extractUserIdFromName(creatorName)}`);
    }

    // Add shortcut filter if enabled and selected
    if (includeShortcuts && selectedShortcut?.filter) {
      conditions.push(selectedShortcut.filter);
    }

    // Add active filters from context
    for (const filter of filters) {
      if (filter.factor === "contentSearch") {
        conditions.push(`content.contains("${filter.value}")`);
      } else if (filter.factor === "tagSearch") {
        conditions.push(`tag in ["${filter.value}"]`);
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
        const displayWithUpdateTime = memoRelatedSetting?.displayWithUpdateTime ?? false;
        const factor = displayWithUpdateTime ? "updated_ts" : "created_ts";

        const filterDate = new Date(filter.value);
        const filterUtcTimestamp = filterDate.getTime() + filterDate.getTimezoneOffset() * 60 * 1000;
        const timestampAfter = filterUtcTimestamp / 1000;

        conditions.push(`${factor} >= ${timestampAfter} && ${factor} < ${timestampAfter + 60 * 60 * 24}`);
      }
    }

    // Add visibility filter if specified
    if (visibilities && visibilities.length > 0) {
      const visibilityValues = visibilities.map((v) => `"${getVisibilityName(v)}"`).join(", ");
      conditions.push(`visibility in [${visibilityValues}]`);
    }

    return conditions.length > 0 ? conditions.join(" && ") : undefined;
  }, [creatorName, includeShortcuts, includePinned, visibilities, selectedShortcut, filters, memoRelatedSetting]);
};
