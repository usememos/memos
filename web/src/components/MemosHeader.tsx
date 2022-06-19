import { useCallback, useEffect, useState } from "react";
import { memoService, shortcutService } from "../services";
import { useAppSelector } from "../store";
import SearchBar from "./SearchBar";
import { toggleSiderbar } from "./Sidebar";
import "../less/memos-header.less";

let prevRequestTimestamp = Date.now();

interface Props {}

const MemosHeader: React.FC<Props> = () => {
  const query = useAppSelector((state) => state.location.query);
  const shortcuts = useAppSelector((state) => state.shortcut.shortcuts);
  const [titleText, setTitleText] = useState("MEMOS");

  useEffect(() => {
    if (!query?.shortcutId) {
      setTitleText("MEMOS");
      return;
    }

    const shortcut = shortcutService.getShortcutById(query?.shortcutId);
    if (shortcut) {
      setTitleText(shortcut.title);
    }
  }, [query, shortcuts]);

  const handleTitleTextClick = useCallback(() => {
    const now = Date.now();
    if (now - prevRequestTimestamp > 10 * 1000) {
      prevRequestTimestamp = now;
      memoService.fetchAllMemos().catch(() => {
        // do nth
      });
    }
  }, []);

  return (
    <div className="section-header-container memos-header-container">
      <div className="title-container">
        <div className="action-btn" onClick={toggleSiderbar}>
          <img src="/icons/menu.svg" className="icon-img" alt="" />
        </div>
        <span className="title-text" onClick={handleTitleTextClick}>
          {titleText}
        </span>
      </div>
      <SearchBar />
    </div>
  );
};

export default MemosHeader;
