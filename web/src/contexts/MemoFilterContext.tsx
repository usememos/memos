import { uniqBy } from "lodash-es";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

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
  } catch {
    return [];
  }
};

export const stringifyFilters = (filters: MemoFilter[]): string => {
  return filters.map((filter) => `${filter.factor}:${encodeURIComponent(filter.value)}`).join(",");
};

interface MemoFilterContextValue {
  filters: MemoFilter[];
  shortcut: string | undefined;
  hasActiveFilters: boolean;
  getFiltersByFactor: (factor: FilterFactor) => MemoFilter[];
  setFilters: (filters: MemoFilter[]) => void;
  addFilter: (filter: MemoFilter) => void;
  removeFilter: (predicate: (f: MemoFilter) => boolean) => void;
  removeFiltersByFactor: (factor: FilterFactor) => void;
  clearAllFilters: () => void;
  setShortcut: (shortcut?: string) => void;
  hasFilter: (filter: MemoFilter) => boolean;
}

const MemoFilterContext = createContext<MemoFilterContextValue | null>(null);

export function MemoFilterProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const lastSyncedUrlRef = useRef("");
  const lastSyncedStoreRef = useRef("");

  // Initialize from URL
  const [filters, setFiltersState] = useState<MemoFilter[]>(() => {
    return parseFilterQuery(searchParams.get("filter"));
  });
  const [shortcut, setShortcutState] = useState<string | undefined>(undefined);

  // Sync URL to state when URL changes externally
  useEffect(() => {
    const filterParam = searchParams.get("filter") || "";
    if (filterParam !== lastSyncedUrlRef.current) {
      lastSyncedUrlRef.current = filterParam;
      const newFilters = parseFilterQuery(filterParam);
      setFiltersState(newFilters);
      lastSyncedStoreRef.current = stringifyFilters(newFilters);
    }
  }, [searchParams]);

  // Sync state to URL when state changes
  useEffect(() => {
    const storeString = stringifyFilters(filters);
    if (storeString !== lastSyncedStoreRef.current && storeString !== lastSyncedUrlRef.current) {
      lastSyncedStoreRef.current = storeString;
      const newParams = new URLSearchParams(searchParams);
      if (filters.length > 0) {
        newParams.set("filter", storeString);
      } else {
        newParams.delete("filter");
      }
      setSearchParams(newParams, { replace: true });
      lastSyncedUrlRef.current = filters.length > 0 ? storeString : "";
    }
  }, [filters, searchParams, setSearchParams]);

  const getFiltersByFactor = useCallback((factor: FilterFactor) => filters.filter((f) => f.factor === factor), [filters]);

  const setFilters = useCallback((newFilters: MemoFilter[]) => {
    setFiltersState(newFilters);
  }, []);

  const addFilter = useCallback((filter: MemoFilter) => {
    setFiltersState((prev) => uniqBy([...prev, filter], getMemoFilterKey));
  }, []);

  const removeFilter = useCallback((predicate: (f: MemoFilter) => boolean) => {
    setFiltersState((prev) => prev.filter((f) => !predicate(f)));
  }, []);

  const removeFiltersByFactor = useCallback((factor: FilterFactor) => {
    setFiltersState((prev) => prev.filter((f) => f.factor !== factor));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFiltersState([]);
    setShortcutState(undefined);
  }, []);

  const setShortcut = useCallback((newShortcut?: string) => {
    setShortcutState(newShortcut);
  }, []);

  const hasFilter = useCallback((filter: MemoFilter) => filters.some((f) => getMemoFilterKey(f) === getMemoFilterKey(filter)), [filters]);

  const hasActiveFilters = filters.length > 0 || shortcut !== undefined;

  return (
    <MemoFilterContext.Provider
      value={{
        filters,
        shortcut,
        hasActiveFilters,
        getFiltersByFactor,
        setFilters,
        addFilter,
        removeFilter,
        removeFiltersByFactor,
        clearAllFilters,
        setShortcut,
        hasFilter,
      }}
    >
      {children}
    </MemoFilterContext.Provider>
  );
}

export function useMemoFilterContext() {
  const context = useContext(MemoFilterContext);
  if (!context) {
    throw new Error("useMemoFilterContext must be used within MemoFilterProvider");
  }
  return context;
}

// Alias for backwards compatibility during migration
export const useMemoFilter = useMemoFilterContext;
