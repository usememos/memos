import { useState } from "react";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import NavigationDrawer from "./NavigationDrawer";

interface Props {
  children?: React.ReactNode;
}

const MobileHeader = (props: Props) => {
  const { children } = props;
  const { sm } = useResponsiveWidth();
  const [titleText] = useState("MEMOS");

  return (
    <div className="sticky top-0 pt-4 sm:pt-1 pb-1 mb-1 backdrop-blur bg-zinc-100 dark:bg-zinc-800 bg-opacity-70 flex md:hidden flex-row justify-between items-center w-full h-auto flex-nowrap shrink-0 z-2">
      <div className="flex flex-row justify-start items-center mr-2 shrink-0 overflow-hidden">
        {!sm && <NavigationDrawer />}
        <span
          className="font-bold text-lg leading-10 mr-1 text-ellipsis shrink-0 cursor-pointer overflow-hidden text-gray-700 dark:text-gray-200"
          onClick={() => location.reload()}
        >
          {titleText}
        </span>
      </div>
      <div className="flex flex-row justify-end items-center">{children}</div>
    </div>
  );
};

export default MobileHeader;
