import { uniq } from "lodash-es";
import { create } from "zustand";
import { combine, persist } from "zustand/middleware";

type FilterFactor =
  | "tag"
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

interface State {
  filters: MemoFilter[];
}

const getDefaultState = (): State => ({
  filters: [],
});

export const useMemoFilterStore = create(
  persist(
    combine(getDefaultState(), (set, get) => ({
      setState: (state: State) => set(state),
      getState: () => get(),
      getFiltersByFactor: (factor: FilterFactor) => get().filters.filter((f) => f.factor === factor),
      addFilter: (filter: MemoFilter) => set((state) => ({ filters: uniq([...state.filters, filter]) })),
      removeFilter: (filterFn: (f: MemoFilter) => boolean) => set((state) => ({ filters: state.filters.filter((f) => !filterFn(f)) })),
    })),
    {
      name: "memo-filter",
    },
  ),
);
