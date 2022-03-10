import { useRef } from "react";
import UserBanner from "./UserBanner";
import ShortcutList from "./ShortcutList";
import TagList from "./TagList";
import UsageHeatMap from "./UsageHeatMap";
import "../less/siderbar.less";

interface Props {}

const Sidebar: React.FC<Props> = () => {
  const wrapperElRef = useRef<HTMLElement>(null);

  return (
    <aside className="sidebar-wrapper" ref={wrapperElRef}>
      <UserBanner />
      <UsageHeatMap />
      <ShortcutList />
      <TagList />
    </aside>
  );
};

export default Sidebar;
