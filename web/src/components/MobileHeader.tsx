import useWindowScroll from "react-use/lib/useWindowScroll";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { workspaceStore } from "@/store/v2";
import { cn } from "@/utils";
import NavigationDrawer from "./NavigationDrawer";

interface Props {
  className?: string;
  children?: React.ReactNode;
}

const MobileHeader = (props: Props) => {
  const { className, children } = props;
  const { sm } = useResponsiveWidth();
  const { y: offsetTop } = useWindowScroll();
  const workspaceGeneralSetting = workspaceStore.state.generalSetting;

  return (
    <div
      className={cn(
        "sticky top-0 pt-3 pb-2 sm:pt-2 px-4 sm:px-6 sm:mb-1 bg-zinc-50 dark:bg-zinc-900 bg-opacity-80 backdrop-blur-lg flex md:hidden flex-row justify-between items-center w-full h-auto flex-nowrap shrink-0 z-1",
        offsetTop > 0 && "shadow-md",
        className,
      )}
    >
      <div className="flex flex-row justify-start items-center mr-2 shrink-0 overflow-hidden">
        {!sm && <NavigationDrawer />}
        <span
          className="font-bold text-lg leading-10 mr-1 text-ellipsis shrink-0 cursor-pointer overflow-hidden text-gray-700 dark:text-gray-300"
          onDoubleClick={() => location.reload()}
        >
          {workspaceGeneralSetting.customProfile?.title || "Memos"}
        </span>
      </div>
      <div className="flex flex-row justify-end items-center">{children}</div>
    </div>
  );
};

export default MobileHeader;
