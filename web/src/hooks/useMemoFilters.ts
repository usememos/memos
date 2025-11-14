import { useMemo } from "react";
import { instanceStore, userStore } from "@/store";
import { extractUserIdFromName } from "@/store/common";
import memoFilterStore from "@/store/memoFilter";
import { InstanceSetting_Key } from "@/types/proto/api/v1/instance_service";
import { Visibility } from "@/types/proto/api/v1/memo_service";

// Helper function to extract shortcut ID from resource name
// Format: users/{user}/shortcuts/{shortcut}
const getShortcutId = (name: string): string => {
  const parts = name.split("/");
  return parts.length === 4 ? parts[3] : "";
};

export interface UseMemoFiltersOptions {
  /**
   * User name to scope memos to (e.g., "users/123")
   * If undefined, no creator filter is applied (useful for Explore page)
   */
  creatorName?: string;

  /**
   * Whether to include shortcut filter from memoFilterStore
   * Default: false
   */
  includeShortcuts?: boolean;

  /**
   * Whether to include pinned filter from memoFilterStore
   * Default: false
   */
  includePinned?: boolean;

  /**
   * Visibility levels to filter by (for Explore page)
   * If provided, adds visibility filter to show only specified visibility levels
   * Default: undefined (no visibility filter)
   *
   * **Security Note**: This filter is enforced at the API level. The backend is responsible
   * for respecting visibility permissions when:
   * - Returning memo lists (filtered by this parameter)
   * - Calculating statistics (should only count visible memos)
   * - Aggregating tags (should only include tags from visible memos)
   *
   * This ensures that private memo data never leaks to unauthorized users through
   * stats, tags, or direct memo access.
   *
   * @example
   * // For logged-in users on Explore
   * visibilities: [Visibility.PUBLIC, Visibility.PROTECTED]
   *
   * @example
   * // For visitors on Explore
   * visibilities: [Visibility.PUBLIC]
   */
  visibilities?: Visibility[];
}

/**
 * Hook to build memo filter string based on active filters and options.
 *
 * This hook consolidates filter building logic that was previously duplicated
 * across Home, Explore, Archived, and UserProfile pages.
 *
 * @param options - Configuration for filter building
 * @returns Filter string to pass to API, or undefined if no filters
 *
 * @example
 * // Home page - include everything
 * const filter = useMemoFilters({
 *   creatorName: user.name,
 *   includeShortcuts: true,
 *   includePinned: true
 * });
 *
 * @example
 * // Explore page - no creator scoping
 * const filter = useMemoFilters({
 *   includeShortcuts: false,
 *   includePinned: false
 * });
 */
export const useMemoFilters = (options: UseMemoFiltersOptions = {}): string | undefined => {
  const { creatorName, includeShortcuts = false, includePinned = false, visibilities } = options;

  // Get selected shortcut if needed
  const selectedShortcut = useMemo(() => {
    if (!includeShortcuts) return undefined;
    return userStore.state.shortcuts.find((shortcut) => getShortcutId(shortcut.name) === memoFilterStore.shortcut);
  }, [includeShortcuts, memoFilterStore.shortcut, userStore.state.shortcuts]);

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
    for (const filter of memoFilterStore.filters) {
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
        const displayWithUpdateTime = instanceStore.getInstanceSettingByKey(InstanceSetting_Key.MEMO_RELATED).memoRelatedSetting
          ?.displayWithUpdateTime;
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
      const visibilityValues = visibilities.map((v) => `"${v}"`).join(", ");
      conditions.push(`visibility in [${visibilityValues}]`);
    }

    return conditions.length > 0 ? conditions.join(" && ") : undefined;
  }, [creatorName, includeShortcuts, includePinned, visibilities, selectedShortcut, memoFilterStore.filters]);
};
