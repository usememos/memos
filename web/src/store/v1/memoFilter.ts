import { uniqBy } from "lodash-es";
import { create } from "zustand";
import { combine } from "zustand/middleware";

export type FilterFactor =
  | "tagSearch"
  | "visibility"
  | "contentSearch"
  | "displayTime"
  | "property.hasLink"
  | "property.hasTaskList"
  | "property.hasCode";

export interface MemoFilter {
  factor: FilterFactor;
  value: string;
}

export const getMemoFilterKey = (filter: MemoFilter) => `${filter.factor}:${filter.value}`;

interface State {
  filters: MemoFilter[];
  orderByTimeAsc: boolean;
}

export const useMemoFilterStore = create(
  combine(((): State => ({ filters: [], orderByTimeAsc: false }))(), (set, get) => ({
    setState: (state: State) => set(state),
    getState: () => get(),
    getFiltersByFactor: (factor: FilterFactor) => get().filters.filter((f) => f.factor === factor),
    addFilter: (filter: MemoFilter) => set((state) => ({ filters: uniqBy([...state.filters, filter], getMemoFilterKey) })),
    removeFilter: (filterFn: (f: MemoFilter) => boolean) => set((state) => ({ filters: state.filters.filter((f) => !filterFn(f)) })),
    setOrderByTimeAsc: (orderByTimeAsc: boolean) => set({ orderByTimeAsc }),
  })),
);
