import { useEffect, useState, useRef } from "react";
import useDebounce from "../hooks/useDebounce";
import { useLocationStore, useDialogStore } from "../store/module";
import Icon from "./Icon";
import "../less/search-bar.less";

const SearchBar = () => {
  const locationStore = useLocationStore();
  const dialogStore = useDialogStore();
  const [queryText, setQueryText] = useState("");
  const [isFocus, setIsFocus] = useState(false);
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

  const handleFocus = () => {
    setIsFocus(true);
  };

  const handleBlur = () => {
    setIsFocus(false);
  };

  return (
    <div className={`search-bar-container ${isFocus ? "is-focus" : ""}`}>
      <div className="search-bar-inputer">
        <Icon.Search className="icon-img" />
        <input
          className="text-input"
          autoComplete="new-password"
          type="text"
          placeholder=""
          ref={inputRef}
          value={queryText}
          onChange={handleTextQueryInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </div>
    </div>
  );
};

export default SearchBar;
