import { useState, useRef } from "react";
import Icon from "./Icon";
import useDebounce from "../hooks/useDebounce";

interface ResourceSearchBarProps {
  setQuery: (queryText: string) => void;
}
const ResourceSearchBar = ({ setQuery }: ResourceSearchBarProps) => {
  const [queryText, setQueryText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleTextQueryInput = (event: React.FormEvent<HTMLInputElement>) => {
    const text = event.currentTarget.value;
    setQueryText(text);
  };

  useDebounce(
    () => {
      setQuery(queryText);
    },
    200,
    [queryText]
  );

  return (
    <div className="w-44 sm:w-52">
      <div className="w-full h-9 flex flex-row justify-start items-center py-2 px-3 rounded-md bg-gray-200 dark:bg-zinc-800">
        <Icon.Search className="w-4 h-auto opacity-30 dark:text-gray-200" />
        <input
          className="flex ml-2 w-24 grow text-sm outline-none bg-transparent dark:text-gray-200"
          type="text"
          placeholder="Search resource "
          ref={inputRef}
          value={queryText}
          onChange={handleTextQueryInput}
        />
      </div>
    </div>
  );
};

export default ResourceSearchBar;
