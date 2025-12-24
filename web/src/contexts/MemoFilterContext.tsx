import { createContext, type ReactNode, useContext, useState } from "react";

export interface FilterFactor {
  tag?: string;
  hasLink?: boolean;
  hasTaskList?: boolean;
  hasCode?: boolean;
  hasMention?: boolean;
  hasSentiment?: boolean;
  text?: string;
  visibility?: string;
  from?: number;
  to?: number;
  property?: {
    key: string;
    value: string;
  };
}

export interface MemoFilter {
  user?: string;
  rowStatus?: string;
  creatorId?: string;
  displayWithPinned?: boolean;
  displayWithUpdatedTs?: boolean;
  contentSearch?: string[];
  limit?: number;
  visibilities?: string[];
  orderByPinned?: boolean;
  orderByTimeAsc?: boolean;
  displayWithNoTag?: boolean;
  tag?: string;
  text?: string;
  hasLink?: boolean;
  hasTaskList?: boolean;
  hasCode?: boolean;
  hasMention?: boolean;
  hasSentiment?: boolean;
  visibility?: string;
  from?: number;
  to?: number;
  property?: {
    key: string;
    value: string;
  };
}

interface MemoFilterContextValue {
  filter: MemoFilter;
  setFilter: (filter: MemoFilter) => void;
  updateFilter: (partial: Partial<MemoFilter>) => void;
  clearFilter: () => void;
}

const MemoFilterContext = createContext<MemoFilterContextValue | null>(null);

export function MemoFilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<MemoFilter>({});

  const updateFilter = (partial: Partial<MemoFilter>) => {
    setFilter((prev) => ({ ...prev, ...partial }));
  };

  const clearFilter = () => {
    setFilter({});
  };

  return (
    <MemoFilterContext.Provider
      value={{
        filter,
        setFilter,
        updateFilter,
        clearFilter,
      }}
    >
      {children}
    </MemoFilterContext.Provider>
  );
}

export function useMemoFilter() {
  const context = useContext(MemoFilterContext);
  if (!context) {
    throw new Error("useMemoFilter must be used within MemoFilterProvider");
  }
  return context;
}
