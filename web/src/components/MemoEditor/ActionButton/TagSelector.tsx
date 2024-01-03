import { IconButton } from "@mui/joy";
import { useEffect } from "react";
import Icon from "@/components/Icon";
import OverflowTip from "@/components/kit/OverflowTip";
import { useTagStore } from "@/store/module";

interface Props {
  onTagSelectorClick: (tag: string) => void;
}

const TagSelector = (props: Props) => {
  const { onTagSelectorClick } = props;
  const tagStore = useTagStore();
  const tags = tagStore.state.tags;

  useEffect(() => {
    (async () => {
      try {
        await tagStore.fetchTags();
      } catch (error) {
        // do nothing.
      }
    })();
  }, []);

  return (
    <IconButton
      className="relative group flex flex-row justify-center items-center p-1 w-auto h-auto mr-1 select-none rounded cursor-pointer text-gray-600 dark:!text-gray-400 hover:bg-gray-300 hover:shadow"
      size="sm"
    >
      <Icon.Hash className="w-5 h-5 mx-auto" />
      <div className="hidden flex-row justify-start items-start flex-wrap absolute top-8 left-0 mt-1 p-1 z-1 rounded w-52 h-auto max-h-48 overflow-y-auto font-mono shadow bg-zinc-100 dark:bg-zinc-700 group-hover:flex">
        {tags.length > 0 ? (
          tags.map((tag) => {
            return (
              <div
                className="w-auto max-w-full text-black dark:text-gray-300 cursor-pointer rounded text-sm leading-6 px-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 shrink-0"
                onClick={() => onTagSelectorClick(tag)}
                key={tag}
              >
                <OverflowTip>#{tag}</OverflowTip>
              </div>
            );
          })
        ) : (
          <p className="italic text-sm ml-2" onClick={(e) => e.stopPropagation()}>
            No tags found
          </p>
        )}
      </div>
    </IconButton>
  );
};

export default TagSelector;
