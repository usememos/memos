import { useMemo } from "react";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { getMemoSuggestions, type MemoSuggestion } from "@/lib/memo-suggestions";
import { useSelectedMemoViewFilter } from "./useMemoFilters";

/** The same browsing context supplies both inline and full-screen composers. */
export function useMemoSuggestions(): MemoSuggestion[] {
  const { filters } = useMemoFilterContext();
  const viewFilter = useSelectedMemoViewFilter();
  return useMemo(() => getMemoSuggestions(filters, viewFilter), [filters, viewFilter]);
}
