import { useContext } from "react";
import { useLocation } from "react-router-dom";
import useNavigateTo from "@/hooks/useNavigateTo";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { memoFilterStore } from "@/store";
import { stringifyFilters, MemoFilter } from "@/store/memoFilter";
import { MemoContentContext } from "./MemoContentContext";

/**
 * Custom span component for #tag elements
 *
 * Handles tag clicks for filtering memos.
 * The remark-tag plugin creates span elements with class="tag".
 *
 * Note: This component should only be used for tags.
 * Regular spans are handled by the default span element.
 */

interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  node?: any; // AST node from react-markdown
  "data-tag"?: string;
  children?: React.ReactNode;
}

export const Tag: React.FC<TagProps> = ({ "data-tag": dataTag, children, className, ...props }) => {
  const context = useContext(MemoContentContext);
  const location = useLocation();
  const navigateTo = useNavigateTo();

  const tag = dataTag || "";

  const handleTagClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (context.disableFilter) {
      return;
    }

    // If the tag is clicked in a memo detail page, we should navigate to the memo list page.
    if (location.pathname.startsWith("/m")) {
      const pathname = context.parentPage || Routes.ROOT;
      const searchParams = new URLSearchParams();

      searchParams.set("filter", stringifyFilters([{ factor: "tagSearch", value: tag }]));
      navigateTo(`${pathname}?${searchParams.toString()}`);
      return;
    }

    const isActive = memoFilterStore.getFiltersByFactor("tagSearch").some((filter: MemoFilter) => filter.value === tag);
    if (isActive) {
      memoFilterStore.removeFilter((f: MemoFilter) => f.factor === "tagSearch" && f.value === tag);
    } else {
      memoFilterStore.addFilter({
        factor: "tagSearch",
        value: tag,
      });
    }
  };

  return (
    <span
      {...props}
      className={cn("inline-block w-auto", context.disableFilter ? "" : "cursor-pointer hover:opacity-80 transition-colors", className)}
      data-tag={tag}
      onClick={handleTagClick}
    >
      {children}
    </span>
  );
};
