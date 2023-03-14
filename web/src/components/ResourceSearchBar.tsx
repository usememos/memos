import { useState, useRef } from "react";
import { useFilterStore, useDialogStore, useLayoutStore } from "../store/module";
import Search from "./base/Search";

const ResourceSearchBar = () => {
  const [queryText, setQueryText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const queryFunction = () => {};

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
