import Icon from "@/components/Icon";
import { useTagStore } from "@/store/module";

interface Props {
  onTagSelectorClick: (tag: string) => void;
}

const TagSelector = (props: Props) => {
  const { onTagSelectorClick } = props;
  const tagStore = useTagStore();
  const tags = tagStore.state.tags;

  return (
    <div className="action-btn relative group">
      <Icon.Hash className="icon-img" />
      <div className="hidden flex-row justify-start items-start flex-wrap absolute top-6 left-0 mt-1 p-1 z-1 rounded w-52 h-auto max-h-48 overflow-y-auto font-mono shadow bg-zinc-200 dark:bg-zinc-600 group-hover:flex">
        {tags.length > 0 ? (
          tags.map((tag) => {
            return (
              <span
                className="w-auto max-w-full truncate text-black dark:text-gray-300 cursor-pointer rounded text-sm leading-6 px-2 hover:bg-zinc-300 dark:hover:bg-zinc-700 shrink-0"
                onClick={() => onTagSelectorClick(tag)}
                key={tag}
              >
                #{tag}
              </span>
            );
          })
        ) : (
          <p className="italic text-sm ml-2" onClick={(e) => e.stopPropagation()}>
            No tags found
          </p>
        )}
      </div>
    </div>
  );
};

export default TagSelector;
