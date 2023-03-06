import { useCallback, useEffect, useState } from "react";
import { useLocationStore, useMemoStore, useShortcutStore } from "../store/module";
import Icon from "./Icon";
import { toggleHeader } from "./Header";
import { toggleHomeSidebar } from "./HomeSidebar";

let prevRequestTimestamp = Date.now();

const MobileHeader = () => {
  const locationStore = useLocationStore();
  const memoStore = useMemoStore();
  const shortcutStore = useShortcutStore();
  const query = locationStore.state.query;
  const shortcuts = shortcutStore.state.shortcuts;
  const [titleText, setTitleText] = useState("MEMOS");

  useEffect(() => {
    if (!query?.shortcutId) {
      setTitleText("MEMOS");
      return;
    }

    const shortcut = shortcutStore.getShortcutById(query?.shortcutId);
    if (shortcut) {
      setTitleText(shortcut.title);
    }
  }, [query, shortcuts]);

  const handleTitleTextClick = useCallback(() => {
    const now = Date.now();
    if (now - prevRequestTimestamp > 1 * 1000) {
      prevRequestTimestamp = now;
      memoStore.fetchMemos().catch(() => {
        // do nth
      });
    }
  }, []);

  return (
    <div className="sticky top-0 pt-4 pb-1 mb-1 backdrop-blur-sm flex sm:hidden flex-row justify-between items-center w-full h-auto flex-nowrap shrink-0 z-10">
      <div className="flex flex-row justify-start items-center mr-2 shrink-0 overflow-hidden">
        <div
          className="flex sm:hidden flex-row justify-center items-center w-6 h-6 mr-1 shrink-0 bg-transparent"
          onClick={() => toggleHeader(true)}
        >
          <Icon.Menu className="w-5 h-auto dark:text-gray-200" />
        </div>
        <span
          className="font-bold text-lg leading-10 mr-1 text-ellipsis shrink-0 cursor-pointer overflow-hidden text-gray-700 dark:text-gray-200"
          onClick={handleTitleTextClick}
        >
          {titleText}
        </span>
      </div>
      <div className="flex flex-row justify-end items-center pr-1">
        <Icon.Search className="w-5 h-auto dark:text-gray-200" onClick={() => toggleHomeSidebar(true)} />
      </div>
    </div>
  );
};

export default MobileHeader;
