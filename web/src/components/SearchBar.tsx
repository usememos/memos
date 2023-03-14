import { useEffect, useState, useRef } from "react";
import useDebounce from "../hooks/useDebounce";
import { useFilterStore, useDialogStore, useLayoutStore } from "../store/module";
import { resolution } from "../utils/layout";
import Search from "./base/Search";
import Icon from "./Icon";

const SearchBar = () => {
  const filterStore = useFilterStore();
  const dialogStore = useDialogStore();
  const layoutStore = useLayoutStore();
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
    const text = filterStore.getState().text;
    setQueryText(text === undefined ? "" : text);
  }, [filterStore.state.text]);

  useEffect(() => {
    if (layoutStore.state.showHomeSidebar) {
      if (window.innerWidth < resolution.sm) {
        inputRef.current?.focus();
      }
    }
  }, [layoutStore.state.showHomeSidebar]);

  useDebounce(
    () => {
      filterStore.setTextFilter(queryText.length === 0 ? undefined : queryText);
    },
    200,
    [queryText]
  );

  const handleTextQueryInput = (event: React.FormEvent<HTMLInputElement>) => {
    const text = event.currentTarget.value;
    setQueryText(text);
  };

  return <Search placeholder="Search memos" inputRef={inputRef} queryText={queryText} handleTextQueryInput={handleTextQueryInput}></Search>;
};

export default SearchBar;
