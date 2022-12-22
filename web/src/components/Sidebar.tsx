import { isUndefined } from "lodash-es";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLocationStore, useUserStore } from "../store/module";
import showDailyReviewDialog from "./DailyReviewDialog";
import showSettingDialog from "./SettingDialog";
import UserBanner from "./UserBanner";
import UsageHeatMap from "./UsageHeatMap";
import ShortcutList from "./ShortcutList";
import TagList from "./TagList";
import "../less/siderbar.less";

const Sidebar = () => {
  const { t } = useTranslation();
  const userStore = useUserStore();
  const locationStore = useLocationStore();
  const query = locationStore.state.query;

  useEffect(() => {
    toggleSidebar(false);
  }, [query]);

  const handleSettingBtnClick = () => {
    showSettingDialog();
  };

  return (
    <>
      <div className="mask" onClick={() => toggleSidebar(false)}></div>
      <aside className="sidebar-wrapper">
        <UserBanner />
        <UsageHeatMap />
        <div className="action-btns-container">
          <button className="btn action-btn" onClick={() => showDailyReviewDialog()}>
            <span className="icon">📅</span> {t("sidebar.daily-review")}
          </button>
          {!userStore.isVisitorMode() && (
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
        {!userStore.isVisitorMode() && (
          <>
            <ShortcutList />
            <TagList />
          </>
        )}
      </aside>
    </>
  );
};

export const toggleSidebar = (show?: boolean) => {
  const sidebarEl = document.body.querySelector(".sidebar-wrapper") as HTMLDivElement;
  const maskEl = document.body.querySelector(".mask") as HTMLDivElement;

  if (isUndefined(show)) {
    show = !sidebarEl.classList.contains("show");
  }

  if (show) {
    sidebarEl.classList.add("show");
    maskEl.classList.add("show");
  } else {
    sidebarEl.classList.remove("show");
    maskEl.classList.remove("show");
  }
};

export default Sidebar;
