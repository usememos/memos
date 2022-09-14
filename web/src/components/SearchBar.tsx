import { locationService } from "../services";
import { useAppSelector } from "../store";
import { memoSpecialTypes } from "../helpers/filter";
import Icon from "./Icon";
import useI18n from "../hooks/useI18n";
import "../less/search-bar.less";

const SearchBar = () => {
  const memoType = useAppSelector((state) => state.location.query?.type);
  const { t } = useI18n();

  const handleMemoTypeItemClick = (type: MemoSpecType | undefined) => {
    const { type: prevType } = locationService.getState().query ?? {};
    if (type === prevType) {
      type = undefined;
    }
    locationService.setMemoTypeQuery(type);
  };

  const handleTextQueryInput = (event: React.FormEvent<HTMLInputElement>) => {
    const text = event.currentTarget.value;
    locationService.setTextQuery(text);
  };

  return (
    <div className="search-bar-container">
      <div className="search-bar-inputer">
        <Icon.Search className="icon-img" />
        <input className="text-input" type="text" placeholder="" onChange={handleTextQueryInput} />
      </div>
      <div className="quickly-action-wrapper">
        <div className="quickly-action-container">
          <p className="title-text">{t("common.quickly-filter")}</p>
          <div className="section-container types-container">
            <span className="section-text">{t("common.types")}:</span>
            <div className="values-container">
              {memoSpecialTypes.map((t, idx) => {
                return (
                  <div key={t.value}>
                    <span
                      className={`type-item ${memoType === t.value ? "selected" : ""}`}
                      onClick={() => {
                        handleMemoTypeItemClick(t.value as MemoSpecType);
                      }}
                    >
                      {t.text}
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
