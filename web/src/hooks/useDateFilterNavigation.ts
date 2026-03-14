import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export const useDateFilterNavigation = (targetPath?: string) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navigateToDateFilter = useCallback(
    (date: string) => {
      const basePath = targetPath ?? location.pathname;

      if (basePath !== location.pathname) {
        navigate(`${basePath}${location.search}#date=${date}`);
        return;
      }

      window.history.replaceState(null, "", `${basePath}${location.search}#date=${date}`);
      window.dispatchEvent(new CustomEvent("memos:jump-to-date", { detail: { date } }));
    },
    [navigate, location.pathname, location.search, targetPath],
  );

  return navigateToDateFilter;
};
