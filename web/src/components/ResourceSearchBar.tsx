import { useState, useRef } from "react";
import { useFilterStore, useDialogStore, useLayoutStore } from "../store/module";
import Search from "./base/Search";

interface ResourceSearchBarProps{
  setQuery: (arg0: string) => void;
}
const ResourceSearchBar = ({ setQuery }: ResourceSearchBarProps) => {
  const [queryText, setQueryText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const queryFunction = () => {
    setQuery(queryText);
  };

  const handleTextQueryInput = (event: React.FormEvent<HTMLInputElement>) => {
    const text = event.currentTarget.value;
    setQueryText(text);
  };

  return (
    <div className="w-6/12">
      <Search
        placeholder="Search Resources"
        inputRef={inputRef}
        queryText={queryText}
        queryFunction={queryFunction}
        handleTextQueryInput={handleTextQueryInput}
      ></Search>
    </div>
  );
};

export default ResourceSearchBar;
