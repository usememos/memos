import { Input } from "@mui/joy";
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
    [queryText]
  );

  const handleTextQueryInput = (event: React.FormEvent<HTMLInputElement>) => {
    setQueryText(event.currentTarget.value);
  };

  return (
    <div className="w-full h-9 flex flex-row justify-start items-center">
      <Input
        className="w-full !text-sm !shadow-none !border-gray-200 dark:!border-zinc-800"
        size="md"
        startDecorator={<Icon.Search className="w-4 h-auto opacity-30" />}
        placeholder={t("memo.search-placeholder")}
        value={queryText}
        onChange={handleTextQueryInput}
      />
    </div>
  );
};

export default SearchBar;
