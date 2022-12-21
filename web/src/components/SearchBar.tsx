import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocationStore, useDialogStore } from "../store/module";
import { memoSpecialTypes } from "../helpers/filter";
import Icon from "./Icon";
import "../less/search-bar.less";

const SearchBar = () => {
  const { t } = useTranslation();
  const locationStore = useLocationStore();
  const dialogStore = useDialogStore();
  const memoType = locationStore.state.query.type;
  const [queryText, setQueryText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocus, setIsFocus] = useState(false);

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
  }, [locationStore.getState().query.text]);

  const handleMemoTypeItemClick = (type: MemoSpecType | undefined) => {
    const { type: prevType } = locationStore.getState().query ?? {};
    if (type === prevType) {
      type = undefined;
    }
    locationStore.setMemoTypeQuery(type);
  };

  const handleTextQueryInput = (event: React.FormEvent<HTMLInputElement>) => {
    const text = event.currentTarget.value;
    setQueryText(text);
    locationStore.setTextQuery(text.length === 0 ? undefined : text);
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
      <div className="quickly-action-wrapper">
        <div className="quickly-action-container">
          <p className="title-text">{t("search.quickly-filter").toUpperCase()}</p>
          <div className="section-container types-container">
            <span className="section-text">{t("common.type").toUpperCase()}:</span>
            <div className="values-container">
              {memoSpecialTypes.map((type, idx) => {
                return (
                  <div key={type.value}>
                    <span
                      className={`type-item ${memoType === type.value ? "selected" : ""}`}
                      onClick={() => {
                        handleMemoTypeItemClick(type.value as MemoSpecType);
                      }}
                    >
                      {t(type.text)}
                    </span>
                    {idx + 1 < memoSpecialTypes.length ? <span className="split-text">/</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchBar;
