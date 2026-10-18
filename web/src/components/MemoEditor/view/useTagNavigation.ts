import { useLocation } from "react-router-dom";
import { isMemoResourcePath, withMemoFilter } from "@/components/MemoView/navigation";
import { type MemoFilter, stringifyFilters, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import useNavigateTo from "@/hooks/useNavigateTo";
import { Routes } from "@/router";

/**
 * What clicking a tag in a memo does. On a memo detail page it opens the collection the
 * memo came from, filtered by the tag. In a list it toggles the tag as the one tag filter.
 */
export function useTagNavigation(parentPage: string | undefined): (tag: string) => void {
  const location = useLocation();
  const navigateTo = useNavigateTo();
  const { getFiltersByFactor, removeFilter, addFilter } = useMemoFilterContext();

  return (tag: string) => {
    if (isMemoResourcePath(location.pathname)) {
      navigateTo(withMemoFilter(parentPage || Routes.HOME, stringifyFilters([{ factor: "tagSearch", value: tag }])));
      return;
    }

    const isActive = getFiltersByFactor("tagSearch").some((filter: MemoFilter) => filter.value === tag);
    if (isActive) {
      removeFilter((f: MemoFilter) => f.factor === "tagSearch" && f.value === tag);
    } else {
      // Remove all existing tag filters first, then add the new one
      removeFilter((f: MemoFilter) => f.factor === "tagSearch");
      addFilter({ factor: "tagSearch", value: tag });
    }
  };
}
