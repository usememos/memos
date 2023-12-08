import { useEffect, useRef, useState } from "react";
import useDebounce from "react-use/lib/useDebounce";
import { useFilterStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import Icon from "./Icon";

const SearchBar = () => {
  const t = useTranslate();
  const filterStore = useFilterStore();
  const [queryText, setQueryText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const text = filterStore.getState().text;
    setQueryText(text === undefined ? "" : text);
  }, [filterStore.state.text]);

  useDebounce(
    () => {
      filterStore.setTextFilter(queryText.length === 0 ? undefined : queryText);
    },
    1000,
    [queryText]
  );

  const handleTextQueryInput = (event: React.FormEvent<HTMLInputElement>) => {
    setQueryText(event.currentTarget.value);
  };

  useEffect(() => {
    // Using `/` as shortcut
    document.addEventListener("keydown", (event) => {
      if (event.key === "/") {
        (
          document.getElementsByClassName("flex ml-2 w-24 grow text-sm outline-none bg-transparent dark:text-gray-200")[0] as HTMLElement
        ).focus();
        event.preventDefault();
      }
    });

    // Using `cmd or ctrl + k` as shortcut
    // let modifierKeyPrefix = "^"; // control key
    // if (navigator.platform.indexOf("Mac") === 1 || navigator.platform === "iPhone") {
    //   modifierKeyPrefix = "⌘"; // command key
    // }
    // // On mac platform
    // document.addEventListener("keydown", (event) => {
    //   if (event.metaKey && event.key === "k") {
    //     (
    //       document.getElementsByClassName("flex ml-2 w-24 grow text-sm outline-none bg-transparent dark:text-gray-200")[0] as HTMLElement
    //     ).focus();
    //     event.preventDefault();
    //   }
    // });

    // // On windows platform
    // document.addEventListener("keydown", (event) => {
    //   if (event.ctrlKey && event.key === "k") {
    //     (
    //       document.getElementsByClassName("flex ml-2 w-24 grow text-sm outline-none bg-transparent dark:text-gray-200")[0] as HTMLElement
    //     ).focus();
    //     event.preventDefault();
    //   }
    // });
  });

  return (
    <div className="w-full h-9 flex flex-row justify-start items-center py-2 px-3 rounded-md bg-gray-200 dark:bg-zinc-700">
      <Icon.Search className="w-4 h-auto opacity-30 dark:text-gray-200" />
      <input
        className="flex ml-2 w-24 grow text-sm outline-none bg-transparent dark:text-gray-200"
        type="text"
        placeholder={t("memo.search-placeholder")}
        ref={inputRef}
        value={queryText}
        onChange={handleTextQueryInput}
      />
      <kbd className="dark:bg-zinc-700 rounded-lg border-2 border-gray-200 dark:border-zinc-600 text-sm dark:text-gray-200">/</kbd>
    </div>
  );
};

export default SearchBar;
