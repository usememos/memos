import { useContext } from "react";
import appContext from "../stores/appContext";
import { locationService } from "../services";
import { memoSpecialTypes } from "../helpers/filter";
import "../less/search-bar.less";

interface Props {}

const SearchBar: React.FC<Props> = () => {
  const {
    locationState: {
      query: { type: memoType },
    },
  } = useContext(appContext);

  const handleMemoTypeItemClick = (type: MemoSpecType | "") => {
    const { type: prevType } = locationService.getState().query;
    if (type === prevType) {
      type = "";
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
        <img className="icon-img" src="/icons/search.svg" />
        <input className="text-input" type="text" placeholder="" onChange={handleTextQueryInput} />
      </div>
      <div className="quickly-action-wrapper">
        <div className="quickly-action-container">
          <p className="title-text">QUICKLY FILTER</p>
          <div className="section-container types-container">
            <span className="section-text">类型:</span>
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
