import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import useDebounce from "@/hooks/useDebounce";
import { useFilterStore } from "@/store/module";
import InputField from "./kit/InputField";
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
    <InputField
      icon={Icon.Search}
      type="search"
      placeholder={t("memo.search-placeholder")}
      ref={inputRef}
      value={queryText}
      onChange={handleTextQueryInput}
    />
  );
};

export default SearchBar;
