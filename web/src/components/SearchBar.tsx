import { useEffect, useState, useRef } from "react";
import useDebounce from "../hooks/useDebounce";
import { useLocationStore, useDialogStore } from "../store/module";
import Icon from "./Icon";

const SearchBar = () => {
  const locationStore = useLocationStore();
  const dialogStore = useDialogStore();
  const [queryText, setQueryText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!inputRef.current) {
        return;
      }
      if (dialogStore.getState().dialogStack.length) {
        return;
      }
      const isMetaKey = event.ctrlKey || event.metaKey;
      if (isMetaKey && event.key === "f") {
        event.preventDefault();
        inputRef.current.focus();
        return;
      }
    };
    document.body.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const text = locationStore.getState().query.text;
    setQueryText(text === undefined ? "" : text);
  }, [locationStore.state.query.text]);

  useDebounce(
    () => {
      locationStore.setTextQuery(queryText.length === 0 ? undefined : queryText);
    },
    200,
    [queryText]
  );

  const handleTextQueryInput = (event: React.FormEvent<HTMLInputElement>) => {
    const text = event.currentTarget.value;
    setQueryText(text);
  };

  return (
    <div className="w-full h-9 flex flex-row justify-start items-center py-2 px-3 rounded-md bg-gray-200 dark:bg-zinc-700">
      <Icon.Search className="w-4 h-auto opacity-30 dark:text-gray-200" />
      <input
        className="flex ml-2 w-24 grow text-sm outline-none bg-transparent dark:text-gray-200"
        type="text"
        placeholder="Search memos"
        ref={inputRef}
        value={queryText}
        onChange={handleTextQueryInput}
      />
    </div>
  );
};

export default SearchBar;
