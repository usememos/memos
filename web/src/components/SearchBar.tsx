import { SearchIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { memoFilterStore } from "@/store/v2";
import { cn } from "@/utils";
import { useTranslate } from "@/utils/i18n";
import MemoDisplaySettingMenu from "./MemoDisplaySettingMenu";

const SearchBar = observer(() => {
  const t = useTranslate();
  const [queryText, setQueryText] = useState("");

  const onTextChange = (event: React.FormEvent<HTMLInputElement>) => {
    setQueryText(event.currentTarget.value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmedText = queryText.trim();
      if (trimmedText !== "") {
        const words = trimmedText.split(/\s+/);
        words.forEach((word) => {
          memoFilterStore.addFilter({
            factor: "contentSearch",
            value: word,
          });
        });
        setQueryText("");
      }
    }
  };

  return (
    <div className="relative w-full h-auto flex flex-row justify-start items-center">
      <SearchIcon className="absolute left-2 w-4 h-auto opacity-40 dark:text-zinc-300" />
      <input
        className={cn(
          "w-full text-gray-500 leading-6 dark:text-zinc-300 placeholder:opacity-80 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm rounded-xl p-1 pl-8 outline-0",
        )}
        placeholder={t("memo.search-placeholder")}
        value={queryText}
        onChange={onTextChange}
        onKeyDown={onKeyDown}
      />
      <MemoDisplaySettingMenu className="absolute right-2 top-2 dark:text-zinc-300" />
    </div>
  );
});

export default SearchBar;
