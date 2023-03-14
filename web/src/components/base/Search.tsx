import { RefObject } from "react";
import Icon from "../Icon";
import useDebounce from "../../hooks/useDebounce";

interface SearchProps {
  placeholder: string;
  inputRef: RefObject<HTMLInputElement>;
  queryText: string;
  handleTextQueryInput: any;
  queryFunction: any;
}

const Search = ({ placeholder, inputRef, queryText, handleTextQueryInput, queryFunction }: SearchProps) => {
  useDebounce(
    () => {
      queryFunction();
      console.log("test");
    },
    200,
    [queryText]
  );

  return (
    <div className="w-full h-9 flex flex-row justify-start items-center py-2 px-3 rounded-md bg-gray-200 dark:bg-zinc-700">
      <Icon.Search className="w-4 h-auto opacity-30 dark:text-gray-200" />
      <input
        className="flex ml-2 w-24 grow text-sm outline-none bg-transparent dark:text-gray-200"
        type="text"
        placeholder={placeholder}
        ref={inputRef}
        value={queryText}
        onChange={handleTextQueryInput}
      />
    </div>
  );
};

export default Search;
