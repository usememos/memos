// Memo Filter Store - manages active memo filters and search state
// This is a client state store that syncs with URL query parameters
import { uniqBy } from "lodash-es";
import { action, computed, makeObservable, observable } from "mobx";
import { StandardState } from "./base-store";

export type FilterFactor =
  | "tagSearch"
  | "visibility"
  | "contentSearch"
  | "displayTime"
  | "pinned"
  | "property.hasLink"
  | "property.hasTaskList"
  | "property.hasCode";

export interface MemoFilter {
  factor: FilterFactor;
  value: string;
}

export const getMemoFilterKey = (filter: MemoFilter): string => `${filter.factor}:${filter.value}`;

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

export const stringifyFilters = (filters: MemoFilter[]): string => {
  return filters.map((filter) => `${filter.factor}:${encodeURIComponent(filter.value)}`).join(",");
};

class MemoFilterState extends StandardState {
  filters: MemoFilter[] = [];
  shortcut?: string = undefined;

  constructor() {
    super();
    makeObservable(this, {
      filters: observable,
      shortcut: observable,
      hasActiveFilters: computed,
      setFilters: action,
      addFilter: action,
      removeFilter: action,
      removeFiltersByFactor: action,
      clearAllFilters: action,
      setShortcut: action,
    });
    this.initFromURL();
  }

  private initFromURL(): void {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      this.filters = parseFilterQuery(searchParams.get("filter"));
    } catch (error) {
      console.warn("Failed to parse filters from URL:", error);
      this.filters = [];
    }
  }

  getFiltersByFactor(factor: FilterFactor): MemoFilter[] {
    return this.filters.filter((f) => f.factor === factor);
  }

  setFilters(filters: MemoFilter[]): void {
    this.filters = filters;
  }

  addFilter(filter: MemoFilter): void {
    this.filters = uniqBy([...this.filters, filter], getMemoFilterKey);
  }

  removeFilter(predicate: (f: MemoFilter) => boolean): void {
    this.filters = this.filters.filter((f) => !predicate(f));
  }

  removeFiltersByFactor(factor: FilterFactor): void {
    this.filters = this.filters.filter((f) => f.factor !== factor);
  }

  clearAllFilters(): void {
    this.filters = [];
    this.shortcut = undefined;
  }

  setShortcut(shortcut?: string): void {
    this.shortcut = shortcut;
  }

  hasFilter(filter: MemoFilter): boolean {
    return this.filters.some((f) => getMemoFilterKey(f) === getMemoFilterKey(filter));
  }

  get hasActiveFilters(): boolean {
    return this.filters.length > 0 || this.shortcut !== undefined;
  }
}

const memoFilterStore = (() => {
  const state = new MemoFilterState();

  return {
    state,
    get filters(): MemoFilter[] {
      return state.filters;
    },
    get shortcut(): string | undefined {
      return state.shortcut;
    },
    get hasActiveFilters(): boolean {
      return state.hasActiveFilters;
    },
    getFiltersByFactor: (factor: FilterFactor): MemoFilter[] => state.getFiltersByFactor(factor),
    setFilters: (filters: MemoFilter[]): void => state.setFilters(filters),
    addFilter: (filter: MemoFilter): void => state.addFilter(filter),
    removeFilter: (predicate: (f: MemoFilter) => boolean): void => state.removeFilter(predicate),
    removeFiltersByFactor: (factor: FilterFactor): void => state.removeFiltersByFactor(factor),
    clearAllFilters: (): void => state.clearAllFilters(),
    setShortcut: (shortcut?: string): void => state.setShortcut(shortcut),
    hasFilter: (filter: MemoFilter): boolean => state.hasFilter(filter),
  };
})();

export default memoFilterStore;
