import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";

export const useDateFilterNavigation = (targetPath?: string) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { filters, setFilters } = useMemoFilterContext();

  const filterByDate = useCallback(
    (date: string) => {
      const nextFilters = [...filters.filter((filter) => filter.factor !== "displayTime"), { factor: "displayTime" as const, value: date }];
      const basePath = targetPath ?? location.pathname;

      if (basePath !== location.pathname) {
        const params = new URLSearchParams(location.search);
        params.set("filter", nextFilters.map((filter) => `${filter.factor}:${encodeURIComponent(filter.value)}`).join(","));
        navigate(`${basePath}?${params.toString()}`);
        return;
      }

      setFilters(nextFilters);
      window.history.replaceState(null, "", `${basePath}${location.search}`);
    },
    [filters, targetPath, location.pathname, location.search, navigate, setFilters],
  );

  const jumpToDate = useCallback(
    (date: string) => {
      const basePath = targetPath ?? location.pathname;

      if (basePath !== location.pathname) {
        navigate(`${basePath}${location.search}#date=${date}`);
        return;
      }

      window.history.replaceState(null, "", `${basePath}${location.search}#date=${date}`);
      window.dispatchEvent(new CustomEvent("memos:jump-to-date", { detail: { date, instant: true } }));
    },
    [navigate, location.pathname, location.search, targetPath],
  );

  return {
    filterByDate,
    jumpToDate,
  };
};
