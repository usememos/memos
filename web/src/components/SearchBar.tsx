import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import useDebounce from "@/hooks/useDebounce";
import { useFilterStore } from "@/store/module";
import Icon from "./Icon";

const SearchBar = () => {
  const { t } = useTranslation();
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
        placeholder={t("memo.search-placeholder")}
        ref={inputRef}
        value={queryText}
        onChange={handleTextQueryInput}
      />
    </div>
  );
};

export default SearchBar;
