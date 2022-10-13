import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { userService } from "../services";
import showDailyReviewDialog from "./DailyReviewDialog";
import showSettingDialog from "./SettingDialog";
import UserBanner from "./UserBanner";
import UsageHeatMap from "./UsageHeatMap";
import ShortcutList from "./ShortcutList";
import TagList from "./TagList";
import { closeSidebar } from "../helpers/utils";
import "../less/siderbar.less";

const Sidebar = () => {
  const { t } = useTranslation();

  const handleSettingBtnClick = () => {
    showSettingDialog();
  };

  return (
    <div>
      <aside className="sidebar-wrapper close-sidebar">
        <UserBanner />
        <UsageHeatMap />
        <div className="action-btns-container">
          <button className="btn action-btn" onClick={() => showDailyReviewDialog()}>
            <span className="icon">📅</span> {t("sidebar.daily-review")}
          </button>
          {!userService.isVisitorMode() && (
            <>
              <Link to="/explore" className="btn action-btn">
                <span className="icon">🏂</span> {t("common.explore")}
              </Link>
              <button className="btn action-btn" onClick={handleSettingBtnClick}>
                <span className="icon">⚙️</span> {t("sidebar.setting")}
              </button>
            </>
          )}
        </div>
        {!userService.isVisitorMode() && <ShortcutList />}
        <TagList />
      </aside>

      <div className="mask" onClick={closeSidebar}></div>
    </div>
  );
};

export const toggleSiderbar = () => {
  const sidebarEl = document.body.querySelector(".sidebar-wrapper") as HTMLDivElement;
  const maskEl = document.body.querySelector(".mask") as HTMLDivElement;
  if (!sidebarEl.classList.contains("close-sidebar")) {
    sidebarEl.classList.replace("open-sidebar", "close-sidebar");
  } else {
    sidebarEl.classList.replace("close-sidebar", "open-sidebar");
    maskEl.classList.contains("hide-mask") ? maskEl.classList.replace("hide-mask", "show-mask") : maskEl.classList.add("show-mask");
  }
};

export default Sidebar;
