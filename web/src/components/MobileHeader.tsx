import { useEffect, useState } from "react";
import { useLayoutStore, useFilterStore, useShortcutStore } from "@/store/module";
import Icon from "./Icon";

interface Props {
  showSearch?: boolean;
}

const MobileHeader = (props: Props) => {
  const { showSearch = true } = props;
  const filterStore = useFilterStore();
  const shortcutStore = useShortcutStore();
  const layoutStore = useLayoutStore();
  const filter = filterStore.state;
  const shortcuts = shortcutStore.state.shortcuts;
  const [titleText, setTitleText] = useState("MEMOS");

  useEffect(() => {
    if (!filter.shortcutId) {
      setTitleText("MEMOS");
      return;
    }

    const shortcut = shortcutStore.getShortcutById(filter.shortcutId);
    if (shortcut) {
      setTitleText(shortcut.title);
    }
  }, [filter, shortcuts]);

  return (
    <div className="sticky top-0 pt-4 pb-1 mb-1 backdrop-blur-sm flex sm:hidden flex-row justify-between items-center w-full h-auto flex-nowrap shrink-0 z-2">
      <div className="flex flex-row justify-start items-center mr-2 shrink-0 overflow-hidden">
        <div
          className="flex sm:hidden flex-row justify-center items-center w-6 h-6 mr-1 shrink-0 bg-transparent"
          onClick={() => layoutStore.setHeaderStatus(true)}
        >
          <Icon.Menu className="w-5 h-auto dark:text-gray-200" />
        </div>
        <span className="font-bold text-lg leading-10 mr-1 text-ellipsis shrink-0 cursor-pointer overflow-hidden text-gray-700 dark:text-gray-200">
          {titleText}
        </span>
      </div>
      <div className={`${showSearch ? "flex" : "hidden"} flex-row justify-end items-center pr-1`}>
        <Icon.Search className="w-5 h-auto dark:text-gray-200" onClick={() => layoutStore.setHomeSidebarStatus(true)} />
      </div>
    </div>
  );
};

export default MobileHeader;
