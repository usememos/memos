import { useCallback, useContext, useEffect, useState } from "react";
import appContext from "../stores/appContext";
import SearchBar from "./SearchBar";
import { memoService, shortcutService } from "../services";
import "../less/memos-header.less";

let prevRequestTimestamp = Date.now();

interface Props {}

const MemosHeader: React.FC<Props> = () => {
  const {
    locationState: {
      query: { shortcutId },
    },
    shortcutState: { shortcuts },
  } = useContext(appContext);

  const [titleText, setTitleText] = useState("MEMOS");

  useEffect(() => {
    if (!shortcutId) {
      setTitleText("MEMOS");
      return;
    }

    const shortcut = shortcutService.getShortcutById(shortcutId);
    if (shortcut) {
      setTitleText(shortcut.title);
    }
  }, [shortcutId, shortcuts]);

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
