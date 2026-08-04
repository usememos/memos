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
      setFilters(nextFilters);
      navigate(`${basePath}?filter=${filterQuery}`);
    },
    [filters, location.pathname, navigate, setFilters, targetPath],
  );

  return navigateToDateFilter;
};
