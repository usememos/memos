import { useTagStore } from "@/store/module";

const TagSuggestions = () => {
  const { tags } = useTagStore().state;
  return (
    <div className="rounded font-mono bg-zinc-200 dark:bg-zinc-600">
      {tags.map((tag) => (
        <div
          key={tag}
          className="rounded p-1 px-2 z-1000 text-sm dark:text-gray-300 cursor-pointer hover:bg-zinc-300 dark:hover:bg-zinc-700"
        >
          #{tag}
        </div>
      ))}
    </div>
  );
};

export default TagSuggestions;
