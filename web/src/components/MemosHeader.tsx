import { useCallback, useContext, useEffect, useState } from "react";
import appContext from "../stores/appContext";
import SearchBar from "./SearchBar";
import { globalStateService, memoService, queryService } from "../services";
import Only from "./common/OnlyWhen";
import "../less/memos-header.less";

let prevRequestTimestamp = Date.now();

interface Props {}

const MemosHeader: React.FC<Props> = () => {
  const {
    locationState: {
      query: { filter },
    },
    globalState: { isMobileView },
    queryState: { queries },
  } = useContext(appContext);

  const [titleText, setTitleText] = useState("MEMOS");

  useEffect(() => {
    const query = queryService.getQueryById(filter);
    if (query) {
      setTitleText(query.title);
    } else {
      setTitleText("MEMOS");
    }
  }, [filter, queries]);

  const handleMemoTextClick = useCallback(() => {
    const now = Date.now();
    if (now - prevRequestTimestamp > 10 * 1000) {
      prevRequestTimestamp = now;
      memoService.fetchAllMemos().catch(() => {
        // do nth
      });
    }
  }, []);

  const handleShowSidebarBtnClick = useCallback(() => {
    globalStateService.setShowSiderbarInMobileView(true);
  }, []);

  return (
    <div className="section-header-container memos-header-container">
      <div className="title-text" onClick={handleMemoTextClick}>
        <Only when={isMobileView}>
          <button className="action-btn" onClick={handleShowSidebarBtnClick}>
            <img className="icon-img" src="/icons/menu.svg" alt="menu" />
          </button>
        </Only>
        <span className="normal-text">{titleText}</span>
      </div>
      <SearchBar />
    </div>
  );
};

export default MemosHeader;
