import clsx from "clsx";
import { useContext } from "react";
import { useMemoFilterStore } from "@/store/v1";
import { RendererContext } from "./types";

interface Props {
  content: string;
}

const Tag: React.FC<Props> = ({ content }: Props) => {
  const context = useContext(RendererContext);
  const memoFilterStore = useMemoFilterStore();

  const handleTagClick = () => {
    if (context.disableFilter) {
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
