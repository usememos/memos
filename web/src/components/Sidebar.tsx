import { Link } from "react-router-dom";
import { userService } from "../services";
import useI18n from "../hooks/useI18n";
import Icon from "./Icon";
import Only from "./common/OnlyWhen";
import showDailyReviewDialog from "./DailyReviewDialog";
import showSettingDialog from "./SettingDialog";
import UserBanner from "./UserBanner";
import UsageHeatMap from "./UsageHeatMap";
import ShortcutList from "./ShortcutList";
import TagList from "./TagList";
import "../less/siderbar.less";

const Sidebar = () => {
  const { t } = useI18n();

  const handleSettingBtnClick = () => {
    showSettingDialog();
  };

  return (
    <aside className="sidebar-wrapper">
      <div className="close-container">
        <span className="action-btn" onClick={toggleSiderbar}>
          <Icon.X className="icon-img" />
        </span>
      </div>
      <UserBanner />
      <UsageHeatMap />
      <div className="action-btns-container">
        <button className="btn action-btn" onClick={() => showDailyReviewDialog()}>
          <span className="icon">📅</span> {t("sidebar.daily-review")}
        </button>
        <Only when={!userService.isVisitorMode()}>
          <Link to="/explore" className="btn action-btn">
            <span className="icon">🏂</span> {t("common.explore")}
          </Link>
          <button className="btn action-btn" onClick={handleSettingBtnClick}>
            <span className="icon">⚙️</span> {t("sidebar.setting")}
          </button>
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
