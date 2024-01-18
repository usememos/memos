import classNames from "classnames";
import { useContext } from "react";
import { useFilterStore } from "@/store/module";
import { RendererContext } from "./types";

interface Props {
  content: string;
}

const Tag: React.FC<Props> = ({ content }: Props) => {
  const context = useContext(RendererContext);
  const filterStore = useFilterStore();

  const handleTagClick = () => {
    if (context.disableFilter) {
      return;
    }

    const currTagQuery = filterStore.getState().tag;
    if (currTagQuery === content) {
      filterStore.setTagFilter(undefined);
    } else {
      filterStore.setTagFilter(content);
    }
  };

  return (
    <span
      className={classNames(
        "inline-block w-auto text-blue-600 dark:text-blue-400",
        context.disableFilter ? "" : "cursor-pointer hover:opacity-80"
      )}
      onClick={handleTagClick}
    >
      #{content}
    </span>
  );
};

export default Tag;
