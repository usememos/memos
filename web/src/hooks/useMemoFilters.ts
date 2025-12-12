import { useMemo } from "react";
import { instanceStore, userStore } from "@/store";
import { extractUserIdFromName, getVisibilityName } from "@/store/common";
import memoFilterStore from "@/store/memoFilter";
import { InstanceSetting_Key } from "@/types/proto/api/v1/instance_service_pb";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";

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

  // Extract MobX observable values to avoid issues with React dependency tracking
  const currentShortcut = memoFilterStore.shortcut;
  const shortcuts = userStore.state.shortcuts;
  const filters = memoFilterStore.filters;

  // Get selected shortcut if needed
  const selectedShortcut = useMemo(() => {
    if (!includeShortcuts) return undefined;
    return shortcuts.find((shortcut) => getShortcutId(shortcut.name) === currentShortcut);
  }, [includeShortcuts, currentShortcut, shortcuts]);

  // Build filter - wrapped in useMemo but also using observer for reactivity
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

    // Add active filters from memoFilterStore
    for (const filter of filters) {
      if (filter.factor === "contentSearch") {
        conditions.push(`content.contains("${filter.value}")`);
      } else if (filter.factor === "tagSearch") {
        conditions.push(`tag in ["${filter.value}"]`);
      } else if (filter.factor === "pinned") {
        if (includePinned) {
          conditions.push(`pinned`);
        }
        // Skip pinned filter if not enabled
      } else if (filter.factor === "property.hasLink") {
        conditions.push(`has_link`);
      } else if (filter.factor === "property.hasTaskList") {
        conditions.push(`has_task_list`);
      } else if (filter.factor === "property.hasCode") {
        conditions.push(`has_code`);
      } else if (filter.factor === "displayTime") {
        // Check instance setting for display time factor
        const setting = instanceStore.getInstanceSettingByKey(InstanceSetting_Key.MEMO_RELATED);
        const displayWithUpdateTime = setting?.value.case === "memoRelatedSetting" ? setting.value.value.displayWithUpdateTime : false;
        const factor = displayWithUpdateTime ? "updated_ts" : "created_ts";

        // Convert date to UTC timestamp range
        const filterDate = new Date(filter.value);
        const filterUtcTimestamp = filterDate.getTime() + filterDate.getTimezoneOffset() * 60 * 1000;
        const timestampAfter = filterUtcTimestamp / 1000;

        conditions.push(`${factor} >= ${timestampAfter} && ${factor} < ${timestampAfter + 60 * 60 * 24}`);
      }
    }

    // Add visibility filter if specified (for Explore page)
    if (visibilities && visibilities.length > 0) {
      // Build visibility filter based on allowed visibility levels
      // Format: visibility in ["PUBLIC", "PROTECTED"]
      // Convert enum values to string names (e.g., 3 -> "PUBLIC", 2 -> "PROTECTED")
      const visibilityValues = visibilities.map((v) => `"${getVisibilityName(v)}"`).join(", ");
      conditions.push(`visibility in [${visibilityValues}]`);
    }

    return conditions.length > 0 ? conditions.join(" && ") : undefined;
  }, [creatorName, includeShortcuts, includePinned, visibilities, selectedShortcut, filters]);
};
