import { observer } from "mobx-react-lite";
import { useContext } from "react";
import { useLocation } from "react-router-dom";
import useNavigateTo from "@/hooks/useNavigateTo";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { memoFilterStore } from "@/store";
import { stringifyFilters, MemoFilter } from "@/store/memoFilter";
import { RendererContext } from "./types";

interface Props {
  content: string;
}

const Tag = observer(({ content }: Props) => {
  const context = useContext(RendererContext);
  const location = useLocation();
  const navigateTo = useNavigateTo();

  const handleTagClick = () => {
    if (context.disableFilter) {
      return;
    }

    // If the tag is clicked in a memo detail page, we should navigate to the memo list page.
    if (location.pathname.startsWith("/m")) {
      const pathname = context.parentPage || Routes.ROOT;
      const searchParams = new URLSearchParams();

      searchParams.set("filter", stringifyFilters([{ factor: "tagSearch", value: content }]));
      navigateTo(`${pathname}?${searchParams.toString()}`);
      return;
    }

    const isActive = memoFilterStore.getFiltersByFactor("tagSearch").some((filter: MemoFilter) => filter.value === content);
    if (isActive) {
      memoFilterStore.removeFilter((f: MemoFilter) => f.factor === "tagSearch" && f.value === content);
    } else {
      memoFilterStore.addFilter({
        factor: "tagSearch",
        value: content,
      });
    }
  };

  return (
    <span
      className={cn(
        "inline-block w-auto px-1 py-px rounded-md text-sm bg-secondary text-secondary-foreground",
        context.disableFilter ? "" : "cursor-pointer hover:opacity-80 transition-colors",
      )}
      onClick={handleTagClick}
    >
      <span className="opacity-70 font-mono">#</span>
      {content}
    </span>
  );
});

export default Tag;
