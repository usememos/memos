import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { useMemoFilterStore } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";
import MemoDisplaySettingMenu from "./MemoDisplaySettingMenu";

const SearchBar = () => {
  const t = useTranslate();
  const memoFilterStore = useMemoFilterStore();
  const [queryText, setQueryText] = useState("");

  const onTextChange = (event: React.FormEvent<HTMLInputElement>) => {
    setQueryText(event.currentTarget.value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (queryText !== "") {
        memoFilterStore.removeFilter((f) => f.factor === "contentSearch");
        memoFilterStore.addFilter({
          factor: "contentSearch",
          value: queryText,
        });
        setQueryText("");
      }
    }
  };

  return (
    <div className="relative w-full h-auto flex flex-row justify-start items-center">
      <SearchIcon className="absolute left-3 w-4 h-auto opacity-40" />
      <input
        className="w-full text-gray-500 dark:text-gray-400 bg-zinc-50 dark:bg-zinc-900 border dark:border-zinc-800 text-sm leading-7 rounded-lg p-1 pl-8 outline-none"
        placeholder={t("memo.search-placeholder")}
        value={queryText}
        onChange={onTextChange}
        onKeyDown={onKeyDown}
      />
      <MemoDisplaySettingMenu className="absolute right-3 top-3" />
    </div>
  );
};

export default SearchBar;
