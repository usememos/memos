import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { stringifyFilters } from "@/contexts/MemoFilterContext";

export const useDateFilterNavigation = () => {
  const navigate = useNavigate();

  const navigateToDateFilter = useCallback(
    (date: string) => {
      const filterQuery = stringifyFilters([{ factor: "displayTime", value: date }]);
      navigate(`/?filter=${filterQuery}`);
    },
    [navigate],
  );

  return navigateToDateFilter;
};
