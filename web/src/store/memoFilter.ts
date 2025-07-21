import { uniqBy } from "lodash-es";
import { makeAutoObservable } from "mobx";

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

export const getMemoFilterKey = (filter: MemoFilter) => `${filter.factor}:${filter.value}`;

export const parseFilterQuery = (query: string | null): MemoFilter[] => {
  if (!query) return [];
  try {
    return query.split(",").map((filterStr) => {
      const [factor, value] = filterStr.split(":");
      return {
        factor: factor as FilterFactor,
        value: decodeURIComponent(value),
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

class MemoFilterState {
  filters: MemoFilter[] = [];
  shortcut?: string = undefined;

  constructor() {
    makeAutoObservable(this);
    this.init();
  }

  init() {
    const searchParams = new URLSearchParams(window.location.search);
    this.filters = parseFilterQuery(searchParams.get("filter"));
  }

  setState(state: Partial<MemoFilterState>) {
    Object.assign(this, state);
  }

  getFiltersByFactor(factor: FilterFactor) {
    return this.filters.filter((f) => f.factor === factor);
  }

  addFilter(filter: MemoFilter) {
    this.filters = uniqBy([...this.filters, filter], getMemoFilterKey);
  }

  removeFilter(filterFn: (f: MemoFilter) => boolean) {
    this.filters = this.filters.filter((f) => !filterFn(f));
  }

  setShortcut(shortcut?: string) {
    this.shortcut = shortcut;
  }
}

const memoFilterStore = (() => {
  const state = new MemoFilterState();

  return {
    get filters() {
      return state.filters;
    },
    get shortcut() {
      return state.shortcut;
    },
    getFiltersByFactor: (factor: FilterFactor) => state.getFiltersByFactor(factor),
    addFilter: (filter: MemoFilter) => state.addFilter(filter),
    removeFilter: (filterFn: (f: MemoFilter) => boolean) => state.removeFilter(filterFn),
    setShortcut: (shortcut?: string) => state.setShortcut(shortcut),
  };
})();

export default memoFilterStore;
