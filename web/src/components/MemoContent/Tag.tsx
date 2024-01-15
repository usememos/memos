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
    if (context.readonly) {
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
    <span className="cursor-pointer inline-block w-auto text-blue-600 dark:text-blue-400 hover:opacity-80" onClick={handleTagClick}>
      #{content}
    </span>
  );
};

export default Tag;
