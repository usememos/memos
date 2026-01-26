import type { Element } from "hast";
import { useLocation } from "react-router-dom";
import { type MemoFilter, stringifyFilters, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import useNavigateTo from "@/hooks/useNavigateTo";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { useMemoViewContext } from "../MemoView/MemoViewContext";

interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  node?: Element; // AST node from react-markdown
  "data-tag"?: string;
  children?: React.ReactNode;
}

export const Tag: React.FC<TagProps> = ({ "data-tag": dataTag, children, className, ...props }) => {
  const { parentPage } = useMemoViewContext();
  const location = useLocation();
  const navigateTo = useNavigateTo();
  const { getFiltersByFactor, removeFilter, addFilter } = useMemoFilterContext();

  const tag = dataTag || "";

  const handleTagClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // If the tag is clicked in a memo detail page, we should navigate to the memo list page.
    if (location.pathname.startsWith("/m")) {
      const pathname = parentPage || Routes.ROOT;
      const searchParams = new URLSearchParams();

      searchParams.set("filter", stringifyFilters([{ factor: "tagSearch", value: tag }]));
      navigateTo(`${pathname}?${searchParams.toString()}`);
      return;
    }

    const isActive = getFiltersByFactor("tagSearch").some((filter: MemoFilter) => filter.value === tag);
    if (isActive) {
      removeFilter((f: MemoFilter) => f.factor === "tagSearch" && f.value === tag);
    } else {
      // Remove all existing tag filters first, then add the new one
      removeFilter((f: MemoFilter) => f.factor === "tagSearch");
      addFilter({
        factor: "tagSearch",
        value: tag,
      });
    }
  };

  return (
    <span
      className={cn("inline-block w-auto text-primary cursor-pointer transition-colors hover:text-primary/80", className)}
      data-tag={tag}
      {...props}
      onClick={handleTagClick}
    >
      {children}
    </span>
  );
};
