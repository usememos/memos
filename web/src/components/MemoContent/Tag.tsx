import clsx from "clsx";
import { useContext } from "react";
import { useLocation } from "react-router-dom";
import useNavigateTo from "@/hooks/useNavigateTo";
import { Routes } from "@/router";
import { stringifyFilters, useMemoFilterStore } from "@/store/v1";
import { RendererContext } from "./types";

interface Props {
  content: string;
}

const Tag: React.FC<Props> = ({ content }: Props) => {
  const context = useContext(RendererContext);
  const memoFilterStore = useMemoFilterStore();
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

    const isActive = memoFilterStore.getFiltersByFactor("tagSearch").some((filter) => filter.value === content);
    if (isActive) {
      memoFilterStore.removeFilter((f) => f.factor === "tagSearch" && f.value === content);
    } else {
      memoFilterStore.addFilter({
        factor: "tagSearch",
        value: content,
      });
    }
  };

  return (
    <span
      className={clsx(
        "inline-block w-auto text-blue-600 dark:text-blue-400",
        context.disableFilter ? "" : "cursor-pointer hover:opacity-80",
      )}
      onClick={handleTagClick}
    >
      #{content}
    </span>
  );
};

export default Tag;
