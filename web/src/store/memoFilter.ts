/**
 * Memo Filter Store
 *
 * Manages active memo filters and search state.
 * This is a client state store that syncs with URL query parameters.
 *
 * Filters are URL-driven and shareable - copying the URL preserves the filter state.
 */
import { uniqBy } from "lodash-es";
import { makeObservable, observable, action, computed } from "mobx";
import { StandardState } from "./base-store";

/**
 * Filter factor types
 * Defines what aspect of a memo to filter by
 */
export type FilterFactor =
  | "tagSearch" // Filter by tag name
  | "visibility" // Filter by visibility (public/private)
  | "contentSearch" // Search in memo content
  | "displayTime" // Filter by date
  | "pinned" // Show only pinned memos
  | "property.hasLink" // Memos containing links
  | "property.hasTaskList" // Memos with task lists
  | "property.hasCode"; // Memos with code blocks

/**
 * Memo filter object
 */
export interface MemoFilter {
  factor: FilterFactor;
  value: string;
}

/**
 * Generate a unique key for a filter
 * Used for deduplication
 */
export const getMemoFilterKey = (filter: MemoFilter): string => `${filter.factor}:${filter.value}`;

/**
 * Parse filter query string from URL into filter objects
 *
 * @param query - URL query string (e.g., "tagSearch:work,pinned:true")
 * @returns Array of filter objects
 */
export const parseFilterQuery = (query: string | null): MemoFilter[] => {
  if (!query) return [];

  try {
    return query.split(",").map((filterStr) => {
      const [factor, value] = filterStr.split(":");
      return {
        factor: factor as FilterFactor,
        value: decodeURIComponent(value || ""),
      };
    });
  } catch (error) {
    console.error("Failed to parse filter query:", error);
    return [];
  }
};

/**
 * Convert filter objects into URL query string
 *
 * @param filters - Array of filter objects
 * @returns URL-encoded query string
 */
export const stringifyFilters = (filters: MemoFilter[]): string => {
  return filters.map((filter) => `${filter.factor}:${encodeURIComponent(filter.value)}`).join(",");
};

/**
 * Memo filter store state
 */
class MemoFilterState extends StandardState {
  /**
   * Active filters
   */
  filters: MemoFilter[] = [];

  /**
   * Currently selected shortcut ID
   * Shortcuts are predefined filter combinations
   */
  shortcut?: string = undefined;

  /**
   * Initialize from URL on construction
   */
  constructor() {
    super();
    makeObservable(this, {
      filters: observable,
      shortcut: observable,
      hasActiveFilters: computed,
      addFilter: action,
      removeFilter: action,
      removeFiltersByFactor: action,
      clearAllFilters: action,
      setShortcut: action,
    });
    this.initFromURL();
  }

  /**
   * Load filters from current URL query parameters
   */
  private initFromURL(): void {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      this.filters = parseFilterQuery(searchParams.get("filter"));
    } catch (error) {
      console.warn("Failed to parse filters from URL:", error);
      this.filters = [];
    }
  }

  /**
   * Get all filters for a specific factor
   *
   * @param factor - The filter factor to query
   * @returns Array of matching filters
   */
  getFiltersByFactor(factor: FilterFactor): MemoFilter[] {
    return this.filters.filter((f) => f.factor === factor);
  }

  /**
   * Add a filter (deduplicates automatically)
   *
   * @param filter - The filter to add
   */
  addFilter(filter: MemoFilter): void {
    this.filters = uniqBy([...this.filters, filter], getMemoFilterKey);
  }

  /**
   * Remove filters matching the predicate
   *
   * @param predicate - Function that returns true for filters to remove
   */
  removeFilter(predicate: (f: MemoFilter) => boolean): void {
    this.filters = this.filters.filter((f) => !predicate(f));
  }

  /**
   * Remove all filters for a specific factor
   *
   * @param factor - The filter factor to remove
   */
  removeFiltersByFactor(factor: FilterFactor): void {
    this.filters = this.filters.filter((f) => f.factor !== factor);
  }

  /**
   * Clear all filters
   */
  clearAllFilters(): void {
    this.filters = [];
    this.shortcut = undefined;
  }

  /**
   * Set the current shortcut
   *
   * @param shortcut - Shortcut ID or undefined to clear
   */
  setShortcut(shortcut?: string): void {
    this.shortcut = shortcut;
  }

  /**
   * Check if a specific filter is active
   *
   * @param filter - The filter to check
   * @returns True if the filter is active
   */
  hasFilter(filter: MemoFilter): boolean {
    return this.filters.some((f) => getMemoFilterKey(f) === getMemoFilterKey(filter));
  }

  /**
   * Check if any filters are active
   */
  get hasActiveFilters(): boolean {
    return this.filters.length > 0 || this.shortcut !== undefined;
  }
}

/**
 * Memo filter store instance
 */
const memoFilterStore = (() => {
  const state = new MemoFilterState();

  return {
    /**
     * Direct access to state for observers
     */
    state,

    /**
     * Get all active filters
     */
    get filters(): MemoFilter[] {
      return state.filters;
    },

    /**
     * Get current shortcut ID
     */
    get shortcut(): string | undefined {
      return state.shortcut;
    },

    /**
     * Check if any filters are active
     */
    get hasActiveFilters(): boolean {
      return state.hasActiveFilters;
    },

    /**
     * Get filters by factor
     */
    getFiltersByFactor: (factor: FilterFactor): MemoFilter[] => state.getFiltersByFactor(factor),

    /**
     * Add a filter
     */
    addFilter: (filter: MemoFilter): void => state.addFilter(filter),

    /**
     * Remove filters matching predicate
     */
    removeFilter: (predicate: (f: MemoFilter) => boolean): void => state.removeFilter(predicate),

    /**
     * Remove all filters for a factor
     */
    removeFiltersByFactor: (factor: FilterFactor): void => state.removeFiltersByFactor(factor),

    /**
     * Clear all filters
     */
    clearAllFilters: (): void => state.clearAllFilters(),

    /**
     * Set current shortcut
     */
    setShortcut: (shortcut?: string): void => state.setShortcut(shortcut),

    /**
     * Check if a filter is active
     */
    hasFilter: (filter: MemoFilter): boolean => state.hasFilter(filter),
  };
})();

export default memoFilterStore;
