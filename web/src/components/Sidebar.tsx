import { userService } from "../services";
import { useAppSelector } from "../store";
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
  const user = useAppSelector((state) => state.user.user);

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
          <i className="fa-solid fa-xmark fa-lg icon-img"></i>
        </span>
      </div>
      <UserBanner />
      <UsageHeatMap />
      <div className="action-btns-container">
        <button className="btn action-btn" onClick={() => showDailyReviewDialog()}>
          <span className="icon">📅</span> Daily Review
        </button>
        <Only when={!userService.isVisitorMode()}>
          <button className="btn action-btn" onClick={handleMyAccountBtnClick}>
            <span className="icon">⚙️</span> Setting
          </button>
        </Only>
        <button className="btn action-btn" onClick={handleArchivedBtnClick}>
          <span className="icon">🗂</span> Archived
        </button>
        <Only when={userService.isVisitorMode()}>
          {user ? (
            <button className="btn action-btn" onClick={() => (window.location.href = "/")}>
              <span className="icon">🏠</span> Back to Home
            </button>
          ) : (
            <button className="btn action-btn" onClick={() => (window.location.href = "/signin")}>
              <span className="icon">👉</span> Sign in
            </button>
          )}
        </Only>
      </div>
      <Only when={!userService.isVisitorMode()}>
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
