import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MemoFilter, stringifyFilters, useMemoFilterContext } from "@/contexts/MemoFilterContext";

export const useDateFilterNavigation = () => {
  const navigate = useNavigate();
  const { filters } = useMemoFilterContext();

  const navigateToDateFilter = useCallback(
    (date: string) => {
      const otherFilters = filters.filter((f) => f.factor !== "displayTime");
      const newFilters: MemoFilter[] = [...otherFilters];
      const existingDateFilter = filters.find((f) => f.factor === "displayTime");

      // If the selected date is different from the current filter, add the new filter.
      // If the selected date is the same, the filter is effectively removed.
      if (existingDateFilter?.value !== date) {
        newFilters.push({ factor: "displayTime", value: date });
      }

      const filterQuery = stringifyFilters(newFilters);
      const targetUrl = filterQuery ? `/?filter=${filterQuery}` : "/";
      navigate(targetUrl);
    },
    [filters, navigate],
  );

  return navigateToDateFilter;
};
