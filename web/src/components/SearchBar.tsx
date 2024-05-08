import { useEffect, useState } from "react";
import useDebounce from "react-use/lib/useDebounce";
import { useFilterStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import Icon from "./Icon";

const SearchBar = () => {
  const t = useTranslate();
  const filterStore = useFilterStore();
  const [queryText, setQueryText] = useState("");

  useEffect(() => {
    const text = filterStore.getState().text;
    setQueryText(text === undefined ? "" : text);
  }, [filterStore.state.text]);

  useDebounce(
    () => {
      filterStore.setTextFilter(queryText.length === 0 ? undefined : queryText);
    },
    1000,
    [queryText],
  );

  const handleTextQueryInput = (event: React.FormEvent<HTMLInputElement>) => {
    setQueryText(event.currentTarget.value);
  };

  return (
    <div className="relative w-full h-auto flex flex-row justify-start items-center">
      <Icon.Search className="absolute left-3 w-4 h-auto opacity-30" />
      <input
        className="w-full text-gray-500 dark:text-gray-400 bg-zinc-50 dark:bg-zinc-900 border dark:border-zinc-800 text-sm leading-7 rounded-lg p-1 pl-8 outline-none"
        placeholder={t("memo.search-placeholder")}
        value={queryText}
        onChange={handleTextQueryInput}
      />
    </div>
  );
};

export default SearchBar;
