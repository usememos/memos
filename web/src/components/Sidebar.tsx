import { userService } from "../services";
import Only from "./common/OnlyWhen";
import showDailyReviewDialog from "./DailyReviewDialog";
import showSettingDialog from "./SettingDialog";
import showArchivedMemoDialog from "./ArchivedMemoDialog";
import UserBanner from "./UserBanner";
import UsageHeatMap from "./UsageHeatMap";
import ShortcutList from "./ShortcutList";
import TagList from "./TagList";
import "../less/siderbar.less";

interface Props {}

const Sidebar: React.FC<Props> = () => {
  const handleMyAccountBtnClick = () => {
    showSettingDialog();
  };

  const handleArchivedBtnClick = () => {
    showArchivedMemoDialog();
  };

  return (
    <aside className="sidebar-wrapper">
      <div className="close-container">
        <span className="action-btn" onClick={toggleSiderbar}>
          <img src="/icons/close.svg" className="icon-img" alt="" />
        </span>
      </div>
      <UserBanner />
      <UsageHeatMap />
      <Only when={!userService.isVisitorMode()}>
        <div className="action-btns-container">
          <button className="btn action-btn" onClick={() => showDailyReviewDialog()}>
            <span className="icon">📅</span> Daily Review
          </button>
          <button className="btn action-btn" onClick={handleMyAccountBtnClick}>
            <span className="icon">⚙️</span> Setting
          </button>
          <button className="btn action-btn" onClick={handleArchivedBtnClick}>
            <span className="icon">🗂</span> Archived
          </button>
        </div>
        <ShortcutList />
      </Only>
      <TagList />
    </aside>
  );
};

export const toggleSiderbar = () => {
  const sidebarEl = document.body.querySelector(".sidebar-wrapper") as HTMLDivElement;
  const display = window.getComputedStyle(sidebarEl).display;
  if (display === "none") {
    sidebarEl.style.display = "flex";
  } else {
    sidebarEl.style.display = "none";
  }
};

export default Sidebar;
