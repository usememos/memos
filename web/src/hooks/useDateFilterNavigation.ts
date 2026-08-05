import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { replaceFiltersByFactor, stringifyFilters, useMemoFilterContext } from "@/contexts/MemoFilterContext";

export const useDateFilterNavigation = (targetPath?: string) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { filters, setFilters } = useMemoFilterContext();

  const navigateToDateFilter = useCallback(
    (date: string) => {
      const nextFilters = replaceFiltersByFactor(filters, "displayTime", [{ factor: "displayTime", value: date }]);
      const filterQuery = stringifyFilters(nextFilters);
      const basePath = targetPath ?? location.pathname;
      const nextSearchParams = targetPath ? new URLSearchParams() : new URLSearchParams(location.search);
      nextSearchParams.set("filter", filterQuery);
      setFilters(nextFilters);
      navigate({ pathname: basePath, search: nextSearchParams.toString() });
    },
    [filters, location.pathname, location.search, navigate, setFilters, targetPath],
  );

  return navigateToDateFilter;
};
