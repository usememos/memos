import { isUndefined } from "lodash-es";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLocationStore, useUserStore } from "../store/module";
import showDailyReviewDialog from "./DailyReviewDialog";
import showResourcesDialog from "./ResourcesDialog";
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
        <div className="w-full px-2 my-2 flex flex-col justify-start items-start shrink-0">
          <button
            className="leading-10 px-4 rounded-lg text-base dark:text-gray-200 hover:bg-white hover:shadow dark:hover:bg-zinc-700"
            onClick={() => showDailyReviewDialog()}
          >
            <span className="mr-1">📅</span> {t("sidebar.daily-review")}
          </button>
          <Link
            to="/explore"
            className="leading-10 px-4 rounded-lg text-base dark:text-gray-200 hover:bg-white hover:shadow dark:hover:bg-zinc-700"
          >
            <span className="mr-1">🏂</span> {t("common.explore")}
          </Link>
          <button
            className="leading-10 px-4 rounded-lg text-base dark:text-gray-200 hover:bg-white hover:shadow dark:hover:bg-zinc-700"
            onClick={() => showResourcesDialog()}
          >
            <span className="mr-1">🗂️</span> {t("sidebar.resources")}
          </button>
          {!userStore.isVisitorMode() && (
            <>
              <button
                className="leading-10 px-4 rounded-lg text-base dark:text-gray-200 hover:bg-white hover:shadow dark:hover:bg-zinc-700"
                onClick={handleSettingBtnClick}
              >
                <span className="mr-1">⚙️</span> {t("sidebar.setting")}
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
