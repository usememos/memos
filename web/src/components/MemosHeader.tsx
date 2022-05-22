import { useCallback, useEffect, useState } from "react";
import { useAppSelector } from "../store";
import SearchBar from "./SearchBar";
import { memoService, shortcutService } from "../services";
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

  const handleMemoTextClick = useCallback(() => {
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
      <div className="title-text" onClick={handleMemoTextClick}>
        <span className="normal-text">{titleText}</span>
      </div>
      <SearchBar />
    </div>
  );
};

export default MemosHeader;
