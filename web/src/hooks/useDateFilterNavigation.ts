import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { stringifyFilters } from "@/contexts/MemoFilterContext";

export const useDateFilterNavigation = (targetPath?: string) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navigateToDateFilter = useCallback(
    (date: string) => {
      const filterQuery = stringifyFilters([{ factor: "displayTime", value: date }]);
      const basePath = targetPath ?? location.pathname;
      navigate(`${basePath}?filter=${filterQuery}`);
    },
    [navigate, location.pathname, targetPath],
  );

  return navigateToDateFilter;
};
